// Logic Lab: a drag-and-wire schematic editor with live simulation, for gate-level and transistor-level levels.
import { mentorSay } from '../../os/mentor';
import { clearDraft, levelRecord, loadDraft, saveDraft } from '../../state';
import { h, svg, toast } from '../../ui/dom';
import { levelHeader } from '../../ui/layout';
import { Circuit, counts, Kind, Part, PINS, Sim, SIZE, starsFor, V, verify } from './circuit';
import { CANVAS, findLogicLevel, starter } from './levels';
import { briefPanel, finish, hintNote, useHints } from '../../ui/labkit';
import { askConfirm } from '../../ui/modal';

const GRID = 10;
const snap = (v: number) => Math.round(v / GRID) * GRID;
const vcls = (v: V) => (v === 1 ? 'v1' : v === 0 ? 'v0' : v === 'x' ? 'vx' : 'vz');

/** Local-coordinate SVG drawing for each part (inside its SIZE box). */
function symbol(p: Part, value: (pin: string) => V, inputVal?: 0 | 1): SVGGElement {
  const g = svg('g', { class: `sym k-${p.kind}` });
  const stub = (x1: number, y1: number, x2: number, y2: number, pin: string) => g.append(svg('line', { x1, y1, x2, y2, class: `stub ${vcls(value(pin))}` }));
  const body = (d: string) => g.append(svg('path', { d, class: 'body' }));
  const bubble = (cx: number, cy: number) => g.append(svg('circle', { cx, cy, r: 4, class: 'body bubble' }));
  const two = () => { stub(0, 10, 12, 10, 'a'); stub(0, 30, 12, 30, 'b'); };
  switch (p.kind) {
    case 'AND': two(); body('M12,2 H32 A18,18 0 0 1 32,38 H12 Z'); stub(50, 20, 60, 20, 'y'); break;
    case 'NAND': two(); body('M12,2 H28 A18,18 0 0 1 28,38 H12 Z'); bubble(50, 20); stub(54, 20, 60, 20, 'y'); break;
    case 'OR': two(); body('M10,2 Q30,2 50,20 Q30,38 10,38 Q20,20 10,2 Z'); stub(50, 20, 60, 20, 'y'); break;
    case 'NOR': two(); body('M10,2 Q28,2 45,20 Q28,38 10,38 Q20,20 10,2 Z'); bubble(49, 20); stub(53, 20, 60, 20, 'y'); break;
    case 'XOR': two(); body('M14,2 Q32,2 50,20 Q32,38 14,38 Q24,20 14,2 Z'); g.append(svg('path', { d: 'M8,2 Q18,20 8,38', class: 'body open' })); stub(50, 20, 60, 20, 'y'); break;
    case 'NOT': stub(0, 20, 14, 20, 'a'); body('M14,6 L44,20 L14,34 Z'); bubble(48, 20); stub(52, 20, 60, 20, 'y'); break;
    case 'DFF':
      stub(0, 20, 12, 20, 'd'); stub(48, 20, 60, 20, 'q');
      body('M12,2 H48 V48 H12 Z');
      g.append(svg('path', { d: 'M12,36 L19,41 L12,46', class: 'body open' }), svg('text', { x: 16, y: 24, class: 'sym-t' }, 'D'), svg('text', { x: 36, y: 24, class: 'sym-t' }, 'Q'));
      break;
    case 'NMOS': case 'PMOS': {
      const pm = p.kind === 'PMOS';
      const top = pm ? 's' : 'd', bot = pm ? 'd' : 's';
      stub(0, 30, pm ? 11 : 18, 30, 'g');
      if (pm) bubble(14, 30);
      g.append(svg('line', { x1: 19, y1: 14, x2: 19, y2: 46, class: 'body open' }), svg('line', { x1: 25, y1: 10, x2: 25, y2: 50, class: `chan ${vcls(value('g')) === (pm ? 'v0' : 'v1') ? 'on' : ''}` }));
      stub(25, 14, 40, 14, top); stub(40, 14, 40, 0, top);
      stub(25, 46, 40, 46, bot); stub(40, 46, 40, 60, bot);
      g.append(svg('text', { x: 44, y: 34, class: 'sym-t' }, pm ? 'P' : 'N'));
      break;
    }
    case 'VDD': stub(30, 30, 30, 12, 'y'); g.append(svg('line', { x1: 14, y1: 12, x2: 46, y2: 12, class: 'body open rail1' }), svg('text', { x: 16, y: 8, class: 'sym-t' }, 'VDD')); break;
    case 'GND': stub(30, 0, 30, 12, 'y'); g.append(svg('path', { d: 'M14,12 H46 M20,18 H40 M26,24 H34', class: 'body open rail0' })); break;
    case 'IN':
      g.append(svg('rect', { x: 0, y: 6, width: 42, height: 28, rx: 6, class: `io in ${inputVal ? 'on' : ''}` }),
        svg('text', { x: 8, y: 25, class: 'io-t' }, `${p.label}`), svg('text', { x: 30, y: 25, class: 'io-v' }, String(inputVal ?? 0)));
      stub(42, 20, 60, 20, 'y');
      break;
    case 'OUT': {
      const v = value('a');
      stub(0, 20, 16, 20, 'a');
      g.append(svg('circle', { cx: 30, cy: 20, r: 13, class: `lamp ${vcls(v)}` }), svg('text', { x: 26, y: 25, class: 'io-v' }, v === 'z' ? '-' : String(v)),
        svg('text', { x: 46, y: 25, class: 'io-t' }, `${p.label}`));
      break;
    }
  }
  return g;
}

function pinPos(p: Part, pin: string): [number, number] {
  const d = PINS[p.kind].find((x) => x.name === pin)!;
  return [p.x + d.dx, p.y + d.dy];
}
const vertical = (p: Part, pin: string) => {
  const d = PINS[p.kind].find((x) => x.name === pin)!;
  return d.dy === 0 || d.dy === SIZE[p.kind][1];
};

export function logicPage(id: string): HTMLElement {
  const level = findLogicLevel(id);
  if (!level) return h('p', null, 'Unknown level.');
  const key = `logic.${level.id}`;
  let circ: Circuit = loadDraft<Circuit>(key) ?? starter(level);
  const { hintBox, usage } = useHints(level.hints, `${key}.usage`, { text: true, ask: 'Ask TAPEOUT for a hint', cost: 'costs a star' });
  const inputs: Record<string, 0 | 1> = Object.fromEntries(level.inputs.map((n) => [n, 0]));
  let sim = new Sim(circ);
  let cycles = 0;
  let selected: { part?: string; wire?: number } = {};
  let pending: string | null = null; // pin ref waiting for a second click
  let rubber: { from: string; x: number; y: number } | null = null;

  const W = CANVAS.w, H = CANVAS.h;
  const canvas = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'logic-svg', tabindex: 0, role: 'application', 'aria-label': 'Schematic editor' });
  const persist = () => saveDraft(key, circ);
  const partOf = (idp: string) => circ.parts.find((p) => p.id === idp)!;

  const resim = (fresh: boolean) => {
    if (fresh) { sim = new Sim(circ); cycles = 0; }
    sim.settle(inputs);
  };

  // ---- rendering
  const draw = () => {
    canvas.replaceChildren();
    for (let x = GRID * 2; x < W; x += GRID * 2) for (let y = GRID * 2; y < H; y += GRID * 2) canvas.append(svg('circle', { cx: x, cy: y, r: 0.8, class: 'dot' }));
    circ.wires.forEach((w, i) => {
      const [pa, na] = w.a.split('.'), [pb, nb] = w.b.split('.');
      const A = partOf(pa), B = partOf(pb);
      if (!A || !B) return;
      const [x1, y1] = pinPos(A, na), [x2, y2] = pinPos(B, nb);
      let d: string;
      if (!vertical(A, na) && !vertical(B, nb)) { const mx = snap((x1 + x2) / 2); d = `M${x1},${y1} H${mx} V${y2} H${x2}`; }
      else { const my = snap((y1 + y2) / 2); d = `M${x1},${y1} V${my} H${x2} V${y2}`; }
      const v = sim.pin(w.a);
      const g = svg('g', { class: `wire ${vcls(v)}${selected.wire === i ? ' sel' : ''}${sim.shorts.has(sim.net(w.a)) ? ' short' : ''}` });
      g.append(svg('path', { d, class: 'hit' }), svg('path', { d, class: 'line' }));
      g.addEventListener('pointerdown', (e) => { e.stopPropagation(); selected = { wire: i }; draw(); });
      g.addEventListener('dblclick', () => removeWire(i));
      canvas.append(g);
    });
    for (const p of circ.parts) {
      const g = svg('g', { class: `part${p.fixed ? ' fixed' : ''}${selected.part === p.id ? ' sel' : ''}`, transform: `translate(${p.x},${p.y})` });
      const [w, hh] = SIZE[p.kind];
      g.append(svg('rect', { x: -3, y: -3, width: w + 6, height: hh + 6, rx: 6, class: 'part-hit' }));
      g.append(symbol(p, (pin) => sim.pin(`${p.id}.${pin}`), p.kind === 'IN' ? inputs[p.label!] : undefined));
      for (const pin of PINS[p.kind]) {
        const ref = `${p.id}.${pin.name}`;
        const c = svg('circle', { cx: pin.dx, cy: pin.dy, r: 5, class: `pin ${vcls(sim.pin(ref))}${pending === ref ? ' pending' : ''}`, 'data-pin': ref });
        c.append(svg('title', {}, `${p.label ?? p.kind} ${pin.name}`));
        g.append(c);
      }
      g.addEventListener('pointerdown', (e) => partDown(e as PointerEvent, p));
      canvas.append(g);
    }
    if (rubber) {
      const [pid, pn] = rubber.from.split('.');
      const [x1, y1] = pinPos(partOf(pid), pn);
      canvas.append(svg('line', { x1, y1, x2: rubber.x, y2: rubber.y, class: 'rubber' }));
    }
    renderSide();
  };

  const toLocal = (e: PointerEvent): [number, number] => {
    const pt = canvas.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = canvas.getScreenCTM();
    if (!m) return [0, 0];
    const q = pt.matrixTransform(m.inverse());
    return [q.x, q.y];
  };

  // ---- editing
  const connect = (a: string, b: string) => {
    if (a === b) return;
    if (circ.wires.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a))) return;
    circ.wires.push({ a, b });
    persist();
    resim(true);
  };
  const removeWire = (i: number) => { circ.wires.splice(i, 1); selected = {}; persist(); resim(true); draw(); };
  const removePart = (pid: string) => {
    const p = partOf(pid);
    if (!p || p.fixed) { toast('Inputs, outputs and the main rails stay put.', 'info'); return; }
    circ.parts = circ.parts.filter((x) => x.id !== pid);
    circ.wires = circ.wires.filter((w) => !w.a.startsWith(`${pid}.`) && !w.b.startsWith(`${pid}.`));
    selected = {};
    persist();
    resim(true);
    draw();
  };
  const deleteSelected = () => {
    if (selected.wire !== undefined) removeWire(selected.wire);
    else if (selected.part) removePart(selected.part);
  };

  const addPart = (kind: Kind) => {
    const [w, hh] = SIZE[kind];
    const overlaps = (x: number, y: number) => circ.parts.some((p) => { const [pw, ph] = SIZE[p.kind]; return x < p.x + pw + 20 && x + w + 20 > p.x && y < p.y + ph + 20 && y + hh + 20 > p.y; });
    let spot: [number, number] = [snap(W / 2 - w / 2), snap(H / 2 - hh / 2)];
    outer: for (let y = 60; y < H - hh - 40; y += 40) for (let x = 110; x < W - w - 110; x += 40) if (!overlaps(x, y)) { spot = [x, y]; break outer; }
    const pid = `${kind.toLowerCase()}_${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`;
    circ.parts.push({ id: pid, kind, x: spot[0], y: spot[1] });
    selected = { part: pid };
    persist();
    resim(true);
    draw();
  };

  const partDown = (e: PointerEvent, p: Part) => {
    e.stopPropagation();
    const pinEl = (e.target as Element).closest('[data-pin]');
    if (pinEl) {
      const ref = pinEl.getAttribute('data-pin')!;
      if (pending && pending !== ref) { connect(pending, ref); pending = null; draw(); return; }
      const [x, y] = toLocal(e);
      rubber = { from: ref, x, y };
      const sx = e.clientX, sy = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => { const [mx, my] = toLocal(ev); rubber = { from: ref, x: mx, y: my }; draw(); };
      const up = (ev: PointerEvent) => {
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        rubber = null;
        const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-pin]')?.getAttribute('data-pin');
        if (target && target !== ref) { connect(ref, target); pending = null; }
        else if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) pending = pending === ref ? null : ref;
        draw();
      };
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      return;
    }
    selected = { part: p.id };
    if (p.kind === 'IN') { inputs[p.label!] ^= 1; resim(false); draw(); return; }
    if (p.fixed) { draw(); return; }
    const [sx, sy] = toLocal(e);
    const ox = p.x, oy = p.y;
    canvas.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const [mx, my] = toLocal(ev);
      const [w, hh] = SIZE[p.kind];
      p.x = Math.max(0, Math.min(W - w, snap(ox + mx - sx)));
      p.y = Math.max(0, Math.min(H - hh, snap(oy + my - sy)));
      draw();
    };
    const up = () => { canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); persist(); };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    draw();
  };
  canvas.addEventListener('pointerdown', () => { selected = {}; pending = null; draw(); });
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
    if (e.key === 'Escape') { pending = null; selected = {}; draw(); }
  });

  // ---- side panel: live truth table / sequence
  const side = h('div', { class: 'logic-side' });
  const renderSide = () => {
    const v = verify(circ, level.inputs, level.outputs, level.spec);
    const cnt = circ.parts.filter((p) => counts(p.kind)).length;
    const unit = level.mode === 'cmos' ? 'transistors' : 'parts';
    side.replaceChildren(
      h('div', { class: 'kpis' },
        h('div', { class: `kpi ${cnt <= level.par ? 'good' : ''}` }, h('small', null, unit), h('b', null, `${cnt} / par ${level.par}`)),
        h('div', { class: `kpi ${v.ok ? 'good' : 'bad'}` }, h('small', null, 'rows passing'), h('b', null, `${v.rows.filter((r) => r.ok).length}/${v.rows.length}`))),
      h('h4', null, level.spec.kind === 'table' ? 'Truth table (live)' : 'Test sequence (live)'),
      h('table', { class: 'tt logic-tt' },
        h('tr', null, ...(level.spec.kind === 'seq' ? [h('th', null, 'step')] : []), ...level.inputs.map((n) => h('th', null, n)), ...level.outputs.map((n) => h('th', { class: 'exp' }, n)), ...level.outputs.map((n) => h('th', null, `your ${n}`)), h('th', null, '')),
        ...v.rows.map((r, i) => h('tr', { class: r.ok ? 'ok' : 'bad' },
          ...(level.spec.kind === 'seq' ? [h('td', null, `${r.tick ? 'clk↑ ' : ''}${r.note ?? i + 1}`)] : []),
          ...level.inputs.map((n) => h('td', null, String(r.inputs[n]))),
          ...level.outputs.map((n) => h('td', { class: 'exp' }, String(r.expected[n]))),
          ...level.outputs.map((n) => h('td', { class: vcls(r.got[n]) }, r.got[n] === 'z' ? '-' : String(r.got[n]))),
          h('td', null, r.ok ? '✓' : '✗')))),
      ...(v.errors.length ? [h('ul', { class: 'messages' }, ...v.errors.slice(0, 3).map((e) => h('li', { class: 'msg err' }, e)))] : []),
    );
  };

  // ---- toolbar & brief
  const hasClock = level.palette.includes('DFF');
  const clockInfo = h('span', { class: 'dim small' });
  const verifyBtn = h('button', { class: 'btn primary', onclick: () => doVerify() }, '✓ Verify');
  const toolbar = h('div', { class: 'toolbar' },
    verifyBtn,
    hasClock ? h('button', { class: 'btn', onclick: () => { sim.tick(); sim.settle(inputs); cycles++; clockInfo.textContent = `${cycles} clock edge${cycles === 1 ? '' : 's'}`; draw(); } }, 'Clock ↑') : null,
    hasClock ? h('button', { class: 'btn ghost', onclick: () => { resim(true); clockInfo.textContent = 'flops reset to 0'; draw(); } }, 'Reset flops') : null,
    clockInfo,
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn ghost small', onclick: deleteSelected, title: 'Delete / Backspace' }, 'Delete selected'),
    h('button', { class: 'btn ghost small', onclick: () => void askConfirm({ title: 'Clear the board?', body: 'Every gate and wire goes, and the level starts again.', confirm: 'Clear', danger: true }).then((ok) => { if (ok) { circ = starter(level); clearDraft(key); resim(true); draw(); } }) }, 'Clear'),
  );

  const doVerify = () => {
    const v = verify(circ, level.inputs, level.outputs, level.spec);
    if (!v.ok) {
      const bad = v.rows.find((r) => !r.ok);
      const msg = v.errors[0] ?? (bad ? `Not yet. With ${Object.entries(bad.inputs).map(([k, x]) => `${k}=${x}`).join(', ')}, ${level.outputs.map((o) => `${o} should be ${bad.expected[o]} but is ${bad.got[o]}`).join(', ')}.` : 'Not yet.');
      mentorSay(msg, 'concerned');
      toast('Verification failed. See the table on the right.', 'err');
      return;
    }
    let st = starsFor(v, level.par);
    st = Math.max(1, st - usage.hints);
    finish(level.id, level.xp, st, [
      v.count > level.par ? `You used ${v.count}; par is ${level.par}. Fewer parts earn more stars.` : '',
      ...hintNote(usage.hints),
    ].filter(Boolean));
  };

  const palette = h('div', { class: 'palette' }, ...level.palette.map((k) => h('button', { class: 'chip', onclick: () => addPart(k), title: `Add a ${k}` }, `+ ${k}`)));
  const brief = briefPanel({ tag: level.concept, html: level.brief, hintBox }, h('h4', null, 'Parts bin'), palette,
    h('p', { class: 'dim small' }, 'Drag parts to move them. Drag from pin to pin (or click one pin, then another) to wire. Click an input switch to toggle it. Select + Delete removes; double-click a wire to cut it.'));

  resim(true);
  draw();
  return h('div', { class: 'level' },
    levelHeader(level.title, level.id, levelRecord(level.id)?.stars ?? 0, level.xp),
    h('div', { class: 'level-grid logic-grid' }, brief,
      h('section', { class: 'work panel' }, toolbar, h('div', { class: 'logic-wrap' }, canvas)),
      h('aside', { class: 'panel' }, side)));
}
