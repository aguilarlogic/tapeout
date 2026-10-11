import { mentorSay } from '../../os/mentor';
import { levelRecord, loadDraft, saveDraft } from '../../state';
import { h, toast } from '../../ui/dom';
import { levelHeader } from '../../ui/layout';
import {
  analyze, Analysis, BoardState, compsOf, emptyBoard, erase, key, Layer, moveComp, netAt, padsOf, placeVia, route, unkey,
} from './board';
import { PCB_LEVELS } from './levels';
import { briefPanel, finish } from '../../ui/labkit';
import { askConfirm } from '../../ui/modal';
import { touchGate } from '../../ui/touch';

type Tool = 'route' | 'via' | 'erase' | 'move';
const CELL = 34;

/** Routing traces needs a mouse: on a phone the board opens behind an honest card (see ui/touch.ts). */
export function pcbPage(id: string): HTMLElement {
  return touchGate('pcb', () => buildPcb(id));
}

function buildPcb(id: string): HTMLElement {
  const level = PCB_LEVELS.find((l) => l.id === id);
  if (!level) return h('p', null, 'Unknown board.');
  const draftKey = `pcb.${level.id}`;

  let st: BoardState = loadDraft<BoardState>(draftKey) ?? emptyBoard();
  let tool: Tool = 'route';
  let layer: Layer = 0;
  const undo: string[] = [];
  let analysis: Analysis = analyze(level, st);
  let highlight: [number, number][] = [];
  let hover: [number, number] | null = null;

  const canvas = h('canvas', { class: 'pcb-canvas', tabindex: '0', 'aria-label': 'PCB routing canvas' });
  const hoverInfo = h('span', { class: 'dim' });
  const issuesEl = h('ul', { class: 'messages' });
  const statsEl = h('div', { class: 'stats' });

  const commit = () => {
    analysis = analyze(level, st);
    saveDraft(draftKey, st);
    renderSide();
    draw();
  };
  const snapshot = () => {
    undo.push(JSON.stringify(st));
    if (undo.length > 100) undo.shift();
  };

  // ---------------------------------------------------------------- toolbar
  const toolBtns = new Map<Tool, HTMLButtonElement>();
  const mkTool = (t: Tool, label: string, keyHint: string) => {
    const b = h('button', { class: 'btn seg', onclick: () => setTool(t), title: `${label} (${keyHint})` }, `${label}`) as HTMLButtonElement;
    toolBtns.set(t, b);
    return b;
  };
  const layerBtns = [0, 1].map((l) =>
    h('button', { class: `btn seg layer-${l}`, onclick: () => setLayer(l as Layer), disabled: l === 1 && level.rules.layers === 1 }, l === 0 ? 'Top' : 'Bottom'),
  ) as HTMLButtonElement[];
  const setTool = (t: Tool) => {
    tool = t;
    toolBtns.forEach((b, k) => b.classList.toggle('on', k === t));
    canvas.style.cursor = t === 'move' ? 'grab' : 'crosshair';
  };
  const setLayer = (l: Layer) => {
    if (l === 1 && level.rules.layers === 1) return;
    layer = l;
    layerBtns.forEach((b, i) => b.classList.toggle('on', i === l));
    draw();
  };

  const toolbar = h('div', { class: 'toolbar' },
    h('div', { class: 'segmented' }, mkTool('route', 'Route', 'R'), mkTool('via', 'Via', 'V'), mkTool('erase', 'Erase', 'E'), level.movable?.length ? mkTool('move', 'Move', 'M') : null),
    h('div', { class: 'segmented' }, ...layerBtns),
    h('button', { class: 'btn ghost', onclick: () => doUndo(), title: 'Ctrl+Z' }, 'Undo'),
    h('button', { class: 'btn ghost', onclick: () => void askConfirm({ title: 'Clear the board?', body: 'Every trace and via goes. You can undo it with Ctrl+Z.', confirm: 'Clear', danger: true }).then((ok) => { if (ok) { snapshot(); st = emptyBoard(); commit(); } }) }, 'Clear'),
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn primary', onclick: () => signoff() }, 'Sign off layout'),
  );
  const doUndo = () => {
    const prev = undo.pop();
    if (prev) { st = JSON.parse(prev); commit(); }
  };

  const signoff = () => {
    analysis = analyze(level, st);
    renderSide();
    if (!analysis.passed) {
      toast('DRC failed - fix the errors listed on the right.', 'err');
      const first = analysis.issues.find((i) => i.severity === 'error') ?? analysis.issues[0];
      mentorSay(first ? `DRC says: ${first.message}` : 'Some nets are still open. Follow the white ratsnest lines.', 'concerned');
      return;
    }
    const notes: string[] = [];
    if (analysis.stars < 3) {
      if (analysis.issues.length) notes.push('Clear the warnings too.');
      if (analysis.totalLength > level.par.length) notes.push(`Total length ${analysis.totalLength} - par is ${level.par.length}.`);
      if (analysis.totalVias > level.par.vias) notes.push(`${analysis.totalVias} vias - par is ${level.par.vias}.`);
    }
    finish(level.id, level.xp, analysis.stars, notes);
  };

  // ---------------------------------------------------------------- side panel
  const renderSide = () => {
    const nets = level.nets.map((n) =>
      h('li', { class: analysis.routed[n.name] ? 'net done' : 'net' },
        h('span', { class: `net-kind k-${n.kind}` }, n.kind),
        h('b', null, n.name),
        h('span', { class: 'dim' }, ` len ${analysis.length[n.name] ?? 0} · vias ${analysis.vias[n.name] ?? 0}`),
        analysis.routed[n.name] ? h('span', { class: 'okmark' }, ' ✓') : null,
      ),
    );
    statsEl.replaceChildren(
      h('ul', { class: 'netlist' }, ...nets),
      h('div', { class: 'par' }, `Length ${analysis.totalLength} / par ${level.par.length} · Vias ${analysis.totalVias} / par ${level.par.vias}`),
    );
    issuesEl.replaceChildren(
      ...(analysis.issues.length
        ? analysis.issues.map((i) =>
            h('li', {
              class: `msg ${i.severity === 'error' ? 'err' : 'warn'} clickable`,
              onclick: () => { highlight = i.cells ?? []; draw(); },
            }, h('b', null, i.severity === 'error' ? 'DRC' : 'Warn'), ' ', i.message))
        : [h('li', { class: 'msg ok' }, analysis.passed ? 'DRC clean. Ready to sign off.' : 'No violations yet.')]),
    );
  };

  // ---------------------------------------------------------------- drawing
  const draw = () => {
    const W = level.w * CELL, H = level.h * CELL;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(canvas);
    const c = (n: string) => css.getPropertyValue(n).trim();
    const COL = { board: c('--pcb-board'), dot: c('--pcb-dot'), top: c('--pcb-top'), bot: c('--pcb-bot'), pad: c('--pcb-pad'), silk: c('--pcb-silk'), plane: c('--pcb-plane'), keep: c('--err'), rats: c('--pcb-rats'), hl: c('--accent') };
    const pads = padsOf(level, st);

    ctx.fillStyle = COL.board;
    ctx.fillRect(0, 0, W, H);

    if (level.rules.gndPlane) {
      ctx.fillStyle = COL.plane;
      ctx.globalAlpha = layer === 1 ? 0.5 : 0.22;
      for (let y = 0; y < level.h; y++) for (let x = 0; x < level.w; x++) {
        if (!analysis.planeCut.has(key(x, y))) ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = COL.dot;
    for (let y = 0; y < level.h; y++) for (let x = 0; x < level.w; x++) ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);

    for (const r of level.keepouts) {
      ctx.save();
      ctx.strokeStyle = COL.keep;
      ctx.globalAlpha = 0.6;
      ctx.strokeRect(r.x * CELL + 2, r.y * CELL + 2, r.w * CELL - 4, r.h * CELL - 4);
      ctx.beginPath();
      ctx.rect(r.x * CELL, r.y * CELL, r.w * CELL, r.h * CELL);
      ctx.clip();
      ctx.beginPath();
      for (let i = -r.h * CELL; i < r.w * CELL; i += 8) {
        ctx.moveTo(r.x * CELL + i, r.y * CELL + r.h * CELL);
        ctx.lineTo(r.x * CELL + i + r.h * CELL, r.y * CELL);
      }
      ctx.stroke();
      ctx.restore();
    }

    // silkscreen outlines
    ctx.strokeStyle = COL.silk;
    ctx.fillStyle = COL.silk;
    ctx.lineWidth = 1.5;
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    for (const comp of compsOf(level, st)) {
      ctx.globalAlpha = 0.7;
      ctx.setLineDash(level.movable?.includes(comp.ref) ? [4, 3] : []);
      ctx.strokeRect(comp.x * CELL + 3, comp.y * CELL + 3, comp.w * CELL - 6, comp.h * CELL - 6);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillText(comp.label, comp.x * CELL + 6, comp.y * CELL + comp.h * CELL - 8 > comp.y * CELL + 14 ? comp.y * CELL + comp.h * CELL - 8 : comp.y * CELL - 3);
    }

    // copper: inactive layer first, dimmed
    const drawLayer = (l: Layer) => {
      ctx.globalAlpha = l === layer ? 1 : 0.35;
      ctx.strokeStyle = l === 0 ? COL.top : COL.bot;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      const own = new Map<string, string>(Object.entries(st.traces[l]));
      for (const [k, n] of Object.entries(st.vias)) own.set(k, n);
      for (const p of pads) if (!p.smd || l === 0) own.set(key(p.x, p.y), p.net);
      ctx.beginPath();
      for (const [k, n] of Object.entries(st.traces[l])) {
        const [x, y] = unkey(k);
        const cx = x * CELL + CELL / 2, cy = y * CELL + CELL / 2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 0.01, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (own.get(key(x + dx, y + dy)) === n) {
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + (dx * CELL) / 2, cy + (dy * CELL) / 2);
          }
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    drawLayer((1 - layer) as Layer);
    drawLayer(layer);

    // pads
    for (const p of pads) {
      const cx = p.x * CELL + CELL / 2, cy = p.y * CELL + CELL / 2;
      ctx.fillStyle = COL.pad;
      ctx.globalAlpha = p.smd && layer === 1 ? 0.4 : 1;
      if (p.smd) ctx.fillRect(cx - 11, cy - 11, 22, 22);
      else {
        ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COL.board;
        ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // vias
    for (const k of Object.keys(st.vias)) {
      const [x, y] = unkey(k);
      const cx = x * CELL + CELL / 2, cy = y * CELL + CELL / 2;
      ctx.fillStyle = COL.silk;
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COL.board;
      ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // pad labels
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (const p of pads) {
      ctx.fillStyle = '#1a1a1a';
      const short = p.name.split('.')[1];
      if (p.smd) ctx.fillText(short.slice(0, 4), p.x * CELL + CELL / 2, p.y * CELL + CELL / 2 + 3);
    }
    ctx.textAlign = 'start';

    // ratsnest
    ctx.strokeStyle = COL.rats;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const r of analysis.ratsnest) {
      ctx.beginPath();
      ctx.moveTo(r.a[0] * CELL + CELL / 2, r.a[1] * CELL + CELL / 2);
      ctx.lineTo(r.b[0] * CELL + CELL / 2, r.b[1] * CELL + CELL / 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // highlights
    ctx.strokeStyle = COL.hl;
    ctx.lineWidth = 2;
    for (const [x, y] of highlight) ctx.strokeRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    if (hover) {
      ctx.globalAlpha = 0.5;
      ctx.strokeRect(hover[0] * CELL + 0.5, hover[1] * CELL + 0.5, CELL - 1, CELL - 1);
      ctx.globalAlpha = 1;
    }
  };

  // ---------------------------------------------------------------- interaction
  let drag: { net?: string; last: [number, number]; ref?: string } | null = null;
  const cellAt = (ev: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [Math.floor((ev.clientX - r.left) / CELL), Math.floor((ev.clientY - r.top) / CELL)];
  };
  const netUnder = (x: number, y: number) => netAt(level, st, layer, x, y) ?? netAt(level, st, (1 - layer) as Layer, x, y);

  const paintTo = (x: number, y: number) => {
    if (!drag) return;
    let [cx, cy] = drag.last;
    const steps: [number, number][] = [];
    while (cx !== x) { cx += Math.sign(x - cx); steps.push([cx, cy]); }
    while (cy !== y) { cy += Math.sign(y - cy); steps.push([cx, cy]); }
    for (const [sx, sy] of steps) {
      if (tool === 'erase') { erase(st, layer, sx, sy); drag.last = [sx, sy]; continue; }
      const r = route(level, st, layer, sx, sy, drag.net!);
      if (!r.ok) { toast(`Can't route there: ${r.reason}`, 'err'); drag = null; commit(); return; }
      drag.last = [sx, sy];
    }
    commit();
  };

  canvas.addEventListener('pointerdown', (ev) => {
    canvas.focus();
    const [x, y] = cellAt(ev);
    highlight = [];
    if (tool === 'via') {
      const net = netAt(level, st, layer, x, y);
      if (!net) { toast('Click the end of a trace to drop a via there.', 'info'); return; }
      snapshot();
      const r = placeVia(level, st, x, y, net);
      if (!r.ok) { undo.pop(); toast(r.reason, 'err'); }
      commit();
      return;
    }
    if (tool === 'move') {
      const pad = padsOf(level, st).find((p) => p.x === x && p.y === y && p.comp && level.movable?.includes(p.comp));
      const comp = pad?.comp ?? compsOf(level, st).find((c) => level.movable?.includes(c.ref) && x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h)?.ref;
      if (!comp) { toast('Only dashed-outline parts can be moved.', 'info'); return; }
      snapshot();
      drag = { last: [x, y], ref: comp };
      canvas.setPointerCapture(ev.pointerId);
      return;
    }
    snapshot();
    if (tool === 'erase') {
      erase(st, layer, x, y);
      drag = { last: [x, y] };
      commit();
    } else {
      const net = netUnder(x, y);
      if (!net) { undo.pop(); toast('Start a trace on a pad, via or existing trace.', 'info'); return; }
      const r = route(level, st, layer, x, y, net);
      if (!r.ok) { undo.pop(); toast(r.reason, 'err'); return; }
      drag = { net, last: [x, y] };
      commit();
    }
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', (ev) => {
    const [x, y] = cellAt(ev);
    if (x < 0 || y < 0 || x >= level.w || y >= level.h) return;
    if (!hover || hover[0] !== x || hover[1] !== y) {
      hover = [x, y];
      const pad = padsOf(level, st).find((p) => p.x === x && p.y === y);
      const n = netUnder(x, y);
      hoverInfo.textContent = `(${x}, ${y})${pad ? ` · ${pad.name}` : ''}${n ? ` · net ${n}` : ''}`;
      if (!drag) draw();
    }
    if (!drag) return;
    if (tool === 'move' && drag.ref) {
      const dx = x - drag.last[0], dy = y - drag.last[1];
      if (dx || dy) {
        const r = moveComp(level, st, drag.ref, dx, dy);
        if (r.ok) { drag.last = [x, y]; commit(); }
      }
      return;
    }
    if (x !== drag.last[0] || y !== drag.last[1]) paintTo(x, y);
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { hover = null; draw(); });

  const onKey = (ev: KeyboardEvent) => {
    if (!document.body.contains(canvas)) { window.removeEventListener('keydown', onKey); return; }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes((ev.target as HTMLElement)?.tagName)) return;
    const win = canvas.closest('.win');
    if (win && !win.classList.contains('focused')) return; // another window has the keyboard
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); doUndo(); return; }
    const k = ev.key.toLowerCase();
    if (k === 'r') setTool('route');
    else if (k === 'v') setTool('via');
    else if (k === 'e') setTool('erase');
    else if (k === 'm' && level.movable?.length) setTool('move');
    else if (k === 'l') setLayer((1 - layer) as Layer);
  };
  window.addEventListener('keydown', onKey);

  setTool('route');
  setLayer(0);
  renderSide();
  requestAnimationFrame(draw);

  const legend = h('div', { class: 'legend' },
    h('span', null, h('i', { class: 'sw top' }), 'top copper'),
    level.rules.layers === 2 ? h('span', null, h('i', { class: 'sw bot' }), 'bottom copper') : null,
    level.rules.gndPlane ? h('span', null, h('i', { class: 'sw plane' }), 'GND plane (bottom)') : null,
    h('span', null, h('i', { class: 'sw pad' }), 'pad (square = SMD, round = through-hole)'),
    hoverInfo,
  );

  return h('div', { class: 'level' },
    levelHeader(level.title, level.id, levelRecord(level.id)?.stars ?? 0, level.xp),
    h('div', { class: 'level-grid pcb-grid' },
      briefPanel({ tag: level.concept, html: level.brief },
        h('p', { class: 'dim small' }, h('span', { class: 'kbd-hint' }, 'Keys: R route · V via · E erase · L switch layer · Ctrl+Z undo. '), 'Click a DRC message to highlight it.')),
      h('section', { class: 'work panel' }, toolbar, h('div', { class: 'pcb-wrap' }, canvas), legend),
      h('aside', { class: 'panel drc' }, h('h4', null, 'Nets'), statsEl, h('h4', null, 'Design rule check'), issuesEl),
    ),
  );
}
