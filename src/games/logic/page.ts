// Logic Lab: the board is the toy. It fills the window, every part says what it is, wires route themselves around
// parts, and "Test it" flips the switches through every row so the lamps light up one by one. Works with a mouse,
// a finger, or a keyboard for the basics (Delete, Escape, Ctrl+Z).
import { findModule, neighbours } from '../../curriculum';
import { award, promotionLine } from '../../mastery/promotion';
import { setMood } from '../../os/avatar';
import { mentorSay } from '../../os/mentor';
import { levelRecord, loadDraft, playerName, saveDraft } from '../../state';
import { recordLabFirstWire, recordLabTest } from '../../steplog';
import { h, stars as starEls, svg } from '../../ui/dom';
import { praise } from '../../ui/layout';
import { playCue } from '../../ui/sound';
import { Bits, Circuit, combos, counts, Kind, Part, PINS, Sim, starsFor, V, verify } from './circuit';
import { fits, freeSpot, GRID, isOutput, K, layoutLab, partSize, pinXY, snap } from './board';
import { findLogicLevel, LogicLevel } from './levels';
import { hitPin, KIND_NAME, partInfo, partLabel, partShapes, pinDotR, vcls } from './parts';
import { route, Routing, wirePath } from './route';
import { Frame, testRun } from './run';
import { KIND_COLOR, themeStyle } from './theme';

/** The first labs show faint outlines where their gates go, so the player learns wiring before layout. */
const SLOT_LABS = new Set(['first-not', 'first-and', 'logic-enable']);
const DRAFT = 'logic2';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Steps of a sequence spec, with the switch settings in force at each step. */
function rowsOf(level: LogicLevel): { ins: Bits; exp: Bits; label?: string }[] {
  if (level.spec.kind === 'table') { const fn = level.spec.fn; return combos(level.inputs).map((ins) => ({ ins, exp: fn(ins) })); }
  const ins: Bits = Object.fromEntries(level.inputs.map((n) => [n, 0]));
  return level.spec.steps.map((st, i) => { Object.assign(ins, st.set ?? {}); return { ins: { ...ins }, exp: st.expect, label: st.note ?? `${st.tick ? 'tick ' : 'step '}${i + 1}` }; });
}

export function logicPage(id: string): HTMLElement {
  const found = findLogicLevel(id);
  if (!found) return h('p', null, 'Unknown level.');
  const level: LogicLevel = found;
  const layout = layoutLab(level);
  const board = layout.board;
  const key = `${DRAFT}.${level.id}`;
  const optional = !!findModule(level.id)?.module.optional;
  /** Core lessons score kindly: no par, and hints cost nothing. */
  const kind = level.mode === 'gate' && !optional;
  const slots = level.mode === 'gate' && !optional ? layout.slots : [];
  const showSlots = SLOT_LABS.has(level.id);
  const hasClock = level.palette.includes('DFF');
  const rows = rowsOf(level);

  /** A saved board is used only if it still has this lab's fixed parts; they go back to their spots. */
  const sane = (c: Circuit | undefined): Circuit | undefined => {
    if (!c?.parts || !c.wires) return undefined;
    for (const f of layout.start.parts) {
      const p = c.parts.find((q) => q.id === f.id);
      if (!p || p.kind !== f.kind) return undefined;
      p.x = f.x; p.y = f.y; p.fixed = true;
    }
    for (const p of c.parts) if (!p.fixed && (!PINS[p.kind] || !fits(c.parts, p.kind, snap(p.x), snap(p.y), board, p.id))) {
      const s = freeSpot(c.parts, p.kind, board, [p.x, p.y], p.id);
      if (!s) return undefined;
      [p.x, p.y] = s;
    }
    return c;
  };
  let circ: Circuit = sane(loadDraft<Circuit>(key)) ?? clone(layout.start);
  const usage = loadDraft<{ hints: number }>(`${key}.usage`) ?? { hints: 0 };

  const inputs: Record<string, 0 | 1> = Object.fromEntries(level.inputs.map((n) => [n, 0]));
  let sim = new Sim(circ);
  sim.settle(inputs);
  let sel: { part?: string; wire?: number } = {};
  let pending: string | null = null;
  let wiring: { from: string; x: number; y: number; target?: string } | null = null;
  let ghost: { kind: Kind; x: number; y: number; ok: boolean } | null = null;
  let frame: Frame | null = null;
  let rowState: ('idle' | 'cur' | 'ok' | 'bad')[] = rows.map(() => 'idle');
  let running = false;
  let pulsing = false;
  let pointAt: string | undefined;
  let nearPin: string | undefined;
  const undo: string[] = [], redo: string[] = [];
  const opened = Date.now();
  let wiredOnce = false;
  let attempts = 0;

  // ---------------------------------------------------------------- the board and its view
  const host = h('div', { class: 'board' });
  const canvas = svg('svg', { class: 'board-svg', role: 'application', tabindex: 0, 'aria-label': `Circuit board: ${level.title}`, preserveAspectRatio: 'xMidYMid meet' });
  host.append(canvas);
  let view = { x: 0, y: 0, w: board.w, h: board.h };
  let autoFit = true;
  let tr = false;
  const size = () => ({ w: host.clientWidth || 640, h: host.clientHeight || 400 });
  const scale = () => { const s = size(); return Math.min(s.w / view.w, s.h / view.h); };
  const fitScale = () => { const s = size(); return Math.min(s.w / (bw() + GRID * 2), s.h / (bh() + GRID * 2)); };
  const applyView = () => { canvas.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); draw(); };
  const bw = () => (tr ? board.h : board.w), bh = () => (tr ? board.w : board.h);
  const fit = () => { view = { x: -GRID, y: -GRID, w: bw() + GRID * 2, h: bh() + GRID * 2 }; autoFit = true; applyView(); };
  /** A wide board on a tall screen (a phone held upright) is shown on its side: signals flow down instead of right. */
  const wantSide = () => { const s = size(); return s.h > s.w * 1.15 && board.w > board.h * 1.1; };
  const zoomAt = (f: number, wx: number, wy: number) => {
    const s0 = scale();
    const s1 = Math.max(fitScale() * 0.9, Math.min(4, s0 * f));
    const k = s0 / s1;
    view = { x: wx - (wx - view.x) * k, y: wy - (wy - view.y) * k, w: view.w * k, h: view.h * k };
    autoFit = false;
    applyView();
  };
  const zoomCenter = (f: number) => zoomAt(f, view.x + view.w / 2, view.y + view.h / 2);
  /** Screen point to board point. When the board is shown on its side, the two axes swap. */
  const toLocal = (cx: number, cy: number): [number, number] => { const [x, y] = toSvg(cx, cy); return tr ? [y, x] : [x, y]; };
  const toSvg = (cx: number, cy: number): [number, number] => {
    const m = canvas.getScreenCTM();
    if (!m) return [0, 0];
    const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return [pt.x, pt.y];
  };
  const resized = () => {
    const side = wantSide();
    if (side !== tr) { tr = side; fit(); } else if (autoFit) fit(); else draw();
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(resized).observe(host);

  let routed: Routing | null = null, routedKey = '';
  const getRoute = (): Routing => {
    const k = JSON.stringify([circ.parts.map((p) => [p.id, p.x, p.y]), circ.wires]);
    if (k !== routedKey || !routed) { routed = route(circ, board); routedKey = k; }
    return routed;
  };
  const val = (ref: string): V => (frame ? frame.pins[ref] ?? 'z' : sim.pin(ref));
  const switchOn = (label: string) => ((frame ? frame.inputs[label] : inputs[label]) ?? 0) as 0 | 1;
  const partOf = (pid: string) => circ.parts.find((p) => p.id === pid);

  /** True when a wire may join these two pins, or the reason it may not, in plain words. */
  const canJoin = (a: string, b: string): true | string => {
    if (a === b) return 'Pick a different dot to wire to.';
    const A = partOf(a.split('.')[0]), B = partOf(b.split('.')[0]);
    if (!A || !B) return 'That part is gone.';
    if (isOutput(A.kind, a.split('.')[1]) && isOutput(B.kind, b.split('.')[1])) return "Two outputs can't share a wire: each one would try to set it to its own value. Wire an output to an input.";
    if (sim.net(a) === sim.net(b) && sim.connected(a)) return 'Those two dots are already joined.';
    return true;
  };

  // ---------------------------------------------------------------- drawing
  const S = (tag: keyof SVGElementTagNameMap, a: Record<string, unknown>, text?: string) => {
    // On a board shown on its side, each text is flipped back about its own anchor, so it still reads upright.
    if (tag === 'text' && tr) { const x = Number(a.x ?? 0), y = Number(a.y ?? 0); a = { ...a, transform: `matrix(0,1,1,0,${x - y},${y - x})` }; }
    const el = svg(tag, a);
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const draw = () => {
    const s = scale();
    const r = getRoute();
    const world = S('g', tr ? { transform: 'matrix(0,1,1,0,0,0)' } : {});
    canvas.replaceChildren(world);
    world.append(
      S('defs', {}),
      S('rect', { x: 0, y: 0, width: board.w, height: board.h, rx: 18, class: 'bd-bg' }),
      S('path', { d: gridPath(board.w, board.h, GRID), class: 'bd-grid' }),
      S('path', { d: gridPath(board.w, board.h, GRID * 5), class: 'bd-grid major' }),
      S('rect', { x: 0, y: 0, width: board.w, height: board.h, rx: 18, class: 'bd-edge' }),
    );
    if (showSlots) {
      for (const sl of slots) {
        if (circ.parts.some((p) => !p.fixed && p.x === sl.x && p.y === sl.y)) continue;
        const [w, hh] = partSize(sl.kind);
        world.append(S('rect', { x: sl.x - 4, y: sl.y - 4, width: w + 8, height: hh + 8, rx: 12, class: 'bslot' }), S('text', { x: sl.x + w / 2, y: sl.y + hh / 2 + 8, class: 'bslot-t' }, `${KIND_NAME[sl.kind]} goes here`));
      }
    }
    // Wires, under the parts.
    for (const rw of r.wires) {
      if (!rw.pts.length) continue;
      const w = circ.wires[rw.wire];
      const v = val(w.a);
      const d = wirePath(rw.pts, r.hops, Math.max(7, 6 / s));
      const g = S('g', { class: `wire ${vcls(v)}${sel.wire === rw.wire ? ' sel' : ''}`, 'data-wire': rw.wire });
      g.append(S('path', { d, class: 'hit' }), S('path', { d, class: 'line' }));
      if (pulsing && v === 1) g.append(S('path', { d, class: 'pulse' }));
      world.append(g);
    }
    for (const [x, y] of r.dots) {
      const rw = r.wires.find((q) => onPath(q.pts, x, y));
      const v = rw ? val(circ.wires[rw.wire].a) : 'z';
      world.append(S('circle', { cx: x, cy: y, r: Math.max(6, 4.5 / s), class: `dot ${vcls(v)}` }));
    }
    // Parts.
    for (const p of circ.parts) {
      const [w, hh] = partSize(p.kind);
      const g = S('g', { class: `part k-${p.kind}${p.fixed ? ' fixed' : ''}${sel.part === p.id ? ' sel' : ''}${pointAt === p.id ? ' point' : ''}`, transform: `translate(${p.x},${p.y})`, style: `--kc:${KIND_COLOR[p.kind]}`, 'data-part': p.id });
      g.append(S('rect', { x: -8, y: -8, width: w + 16, height: hh + 16, rx: 12, class: 'part-hit' }));
      const inner = S('g', { transform: `scale(${K})` });
      for (const sh of partShapes(p, (pin) => val(`${p.id}.${pin}`), p.kind === 'IN' ? switchOn(p.label ?? '') : undefined)) inner.append(S(sh.t, sh.a, sh.text));
      g.append(inner, S('title', {}, partLabel(p)));
      world.append(g);
    }
    // Pins on top, at a size that stays readable at any zoom.
    const picked = wiring?.from ?? pending;
    for (const p of circ.parts) {
      for (const d of PINS[p.kind]) {
        const ref = `${p.id}.${d.name}`;
        const [x, y] = pinXY(p, d.name);
        const can = picked && picked !== ref && canJoin(picked, ref) === true;
        const cls = `pin ${vcls(val(ref))}${can ? ' can' : ''}${picked === ref ? ' picked' : ''}${nearPin === ref || wiring?.target === ref ? ' near' : ''}`;
        world.append(S('circle', { cx: x, cy: y, r: pinDotR(s) * (nearPin === ref || wiring?.target === ref ? 1.35 : 1), class: cls, 'data-pin': ref }));
      }
    }
    if (ghost) {
      const [w, hh] = partSize(ghost.kind);
      const g = S('g', { class: `part ghost k-${ghost.kind}${ghost.ok ? '' : ' blocked'}`, transform: `translate(${ghost.x},${ghost.y})`, style: `--kc:${KIND_COLOR[ghost.kind]}` });
      const inner = S('g', { transform: `scale(${K})` });
      for (const sh of partShapes({ id: 'ghost', kind: ghost.kind, x: 0, y: 0 }, () => 'z')) inner.append(S(sh.t, sh.a, sh.text));
      g.append(S('rect', { x: -6, y: -6, width: w + 12, height: hh + 12, rx: 10, class: 'ghost-box' }), inner);
      world.append(g);
    }
    if (wiring) {
      const [pid, pin] = wiring.from.split('.');
      const [x1, y1] = pinXY(partOf(pid)!, pin);
      const tp = wiring.target ? partOf(wiring.target.split('.')[0]) : undefined;
      const [x2, y2] = tp ? pinXY(tp, wiring.target!.split('.')[1]) : [wiring.x, wiring.y];
      world.append(S('line', { x1, y1, x2, y2, class: `rubber${wiring.target ? ' snap' : ''}` }));
    }
    // A delete badge on whatever is selected.
    const badge = (x: number, y: number) => {
      const rr = Math.max(12, 16 / s);
      const g = S('g', { class: 'del', 'data-del': '1', transform: `translate(${x},${y})` });
      g.append(S('circle', { r: rr }), S('text', { y: rr * 0.38, 'font-size': rr * 1.1 }, '✕'), S('title', {}, 'Delete'));
      world.append(g);
    };
    if (sel.wire !== undefined) {
      const rw = r.wires.find((q) => q.wire === sel.wire);
      if (rw?.pts.length) { const [x, y] = midpoint(rw.pts); badge(x, y); }
    } else if (sel.part) {
      const p = partOf(sel.part);
      if (p && !p.fixed) badge(p.x + partSize(p.kind)[0] + 4, p.y - 4);
    }
  };

  // ---------------------------------------------------------------- editing
  const persist = () => saveDraft(key, circ);
  /** Something on the board changed: re-simulate live, and forget the last test run. */
  const changed = () => {
    persist();
    sim = new Sim(circ);
    sim.settle(inputs);
    frame = null;
    pointAt = undefined;
    rowState = rows.map(() => 'idle');
    draw();
    renderRows();
    renderTools();
  };
  const mutate = (fn: () => void) => {
    undo.push(JSON.stringify(circ));
    if (undo.length > 200) undo.shift();
    redo.length = 0;
    fn();
    changed();
  };
  const doUndo = () => { if (!undo.length || running) return; redo.push(JSON.stringify(circ)); circ = JSON.parse(undo.pop()!); sel = {}; changed(); };
  const doRedo = () => { if (!redo.length || running) return; undo.push(JSON.stringify(circ)); circ = JSON.parse(redo.pop()!); sel = {}; changed(); };

  const connect = (a: string, b: string) => {
    const ok = canJoin(a, b);
    if (ok !== true) { say(ok, 'warn'); return; }
    mutate(() => circ.wires.push({ a, b }));
    if (!wiredOnce) { wiredOnce = true; recordLabFirstWire(level.id, (Date.now() - opened) / 1000); }
    say(circ.wires.length === 1 ? 'Wired! Tap a switch to see the signal travel, or press Test it.' : '', 'info');
  };
  const deleteSelected = () => {
    if (running) return;
    if (sel.wire !== undefined) { const i = sel.wire; sel = {}; mutate(() => circ.wires.splice(i, 1)); say('Wire removed. Undo brings it back.', 'info'); return; }
    const p = sel.part ? partOf(sel.part) : undefined;
    if (!p) return;
    if (p.fixed) { say('Switches and lamps stay where they are.', 'info'); return; }
    sel = {};
    mutate(() => {
      circ.parts = circ.parts.filter((x) => x.id !== p.id);
      circ.wires = circ.wires.filter((w) => !w.a.startsWith(`${p.id}.`) && !w.b.startsWith(`${p.id}.`));
    });
  };
  /** Where a new part goes: the free spot made for it in this lab if there is one, else the nearest free spot. */
  const spotFor = (kindOf: Kind, near?: [number, number]): [number, number] | undefined => {
    if (!near) for (const sl of slots) if (sl.kind === kindOf && fits(circ.parts, kindOf, sl.x, sl.y, board)) return [sl.x, sl.y];
    return freeSpot(circ.parts, kindOf, board, near);
  };
  const addPart = (kindOf: Kind, at?: [number, number]) => {
    const spot = at && fits(circ.parts, kindOf, at[0], at[1], board) ? at : spotFor(kindOf, at);
    if (!spot) { say('The board is full. Delete a part to make room.', 'warn'); return; }
    const pid = `${kindOf.toLowerCase()}_${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`;
    mutate(() => circ.parts.push({ id: pid, kind: kindOf, x: spot[0], y: spot[1] }));
    sel = { part: pid };
    say(`${partInfo({ id: pid, kind: kindOf, x: 0, y: 0 })} Drag from its dots to wire it.`, 'info');
    draw();
  };
  const setInput = (label: string, v: 0 | 1) => { inputs[label] = v; frame = null; sim.settle(inputs); draw(); renderRows(); };

  // ---------------------------------------------------------------- pointer input on the board
  type Gesture = { move(e: PointerEvent): void; up(e: PointerEvent): void };
  let gesture: Gesture | null = null;
  const touches = new Map<number, [number, number]>();
  let pinch: { d0: number; s0: number } | null = null;

  const pinGesture = (e: PointerEvent, from: string): Gesture => {
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const [wx, wy] = toLocal(e.clientX, e.clientY);
    wiring = { from, x: wx, y: wy };
    draw();
    return {
      move(ev) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true;
        const [x, y] = toLocal(ev.clientX, ev.clientY);
        const target = hitPin(circ.parts, x, y, scale(), (ref) => ref !== from && canJoin(from, ref) === true, 1.6);
        wiring = { from, x, y, target };
        draw();
      },
      up(ev) {
        const target = wiring?.target;
        wiring = null;
        if (target) { pending = null; connect(from, target); return; }
        if (!moved) {
          pending = pending === from ? null : from;
          if (pending) say('Now tap the dot you want to wire it to. The dots you can use are glowing.', 'info');
        } else {
          const [x, y] = toLocal(ev.clientX, ev.clientY);
          const over = hitPin(circ.parts, x, y, scale(), (ref) => ref !== from);
          const why = over ? canJoin(from, over) : true;
          if (why !== true) say(why, 'warn');
        }
        draw();
      },
    };
  };

  const partGesture = (e: PointerEvent, p: Part): Gesture => {
    const sx = e.clientX, sy = e.clientY;
    const [wx0, wy0] = toLocal(e.clientX, e.clientY);
    const ox = p.x, oy = p.y;
    const before = JSON.stringify(circ);
    let moved = false;
    sel = { part: p.id };
    pending = null;
    draw();
    return {
      move(ev) {
        if (p.fixed) return;
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        moved = true;
        const [x, y] = toLocal(ev.clientX, ev.clientY);
        const [w, hh] = partSize(p.kind);
        p.x = Math.max(GRID, Math.min(board.w - w - GRID, snap(ox + x - wx0)));
        p.y = Math.max(GRID, Math.min(board.h - hh - GRID, snap(oy + y - wy0)));
        draw();
      },
      up() {
        if (moved) {
          if (!fits(circ.parts, p.kind, p.x, p.y, board, p.id)) [p.x, p.y] = freeSpot(circ.parts, p.kind, board, [p.x, p.y], p.id) ?? [ox, oy];
          if (p.x !== ox || p.y !== oy) { undo.push(before); redo.length = 0; changed(); } else draw();
          return;
        }
        if (p.kind === 'IN' && p.label) setInput(p.label, switchOn(p.label) ? 0 : 1);
        say(partInfo(p), 'info');
        draw();
      },
    };
  };

  const panGesture = (e: PointerEvent): Gesture => {
    let lx = e.clientX, ly = e.clientY, moved = false;
    const sx = lx, sy = ly;
    return {
      move(ev) {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        moved = true;
        const s = scale();
        view.x -= (ev.clientX - lx) / s;
        view.y -= (ev.clientY - ly) / s;
        lx = ev.clientX; ly = ev.clientY;
        autoFit = false;
        applyView();
      },
      up() { if (!moved) { sel = {}; pending = null; draw(); } },
    };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (running) return;
    canvas.focus({ preventScroll: true });
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    canvas.setPointerCapture(e.pointerId);
    if (touches.size === 2) {
      // Two fingers: pinch to zoom. Whatever one finger had started is dropped.
      const [a, b] = [...touches.values()];
      pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]), s0: scale() };
      wiring = null; gesture = null; ghost = null;
      draw();
      return;
    }
    if (frame) { frame = null; draw(); }
    pointAt = undefined;
    const [wx, wy] = toLocal(e.clientX, e.clientY);
    const t = e.target as Element;
    if (t.closest('[data-del]')) { deleteSelected(); return; }
    const pin = hitPin(circ.parts, wx, wy, scale());
    if (pin) {
      if (pending && pending !== pin) { const from = pending; pending = null; connect(from, pin); return; }
      gesture = pinGesture(e, pin);
      return;
    }
    const wireEl = t.closest('[data-wire]');
    if (wireEl) {
      sel = { wire: Number(wireEl.getAttribute('data-wire')) };
      pending = null;
      say('Tap the ✕ to delete this wire.', 'info');
      draw();
      return;
    }
    const partEl = t.closest('[data-part]');
    const p = partEl ? partOf(partEl.getAttribute('data-part')!) : undefined;
    gesture = p ? partGesture(e, p) : panGesture(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const [mx, my] = toSvg((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      zoomAt((pinch.s0 * (d / Math.max(1, pinch.d0))) / scale(), mx, my);
      return;
    }
    if (gesture) { gesture.move(e); return; }
    if (e.pointerType === 'mouse' && !running) {
      const [x, y] = toLocal(e.clientX, e.clientY);
      const near = hitPin(circ.parts, x, y, scale());
      if (near !== nearPin) { nearPin = near; draw(); }
    }
  });
  const end = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) pinch = null; return; }
    const g = gesture;
    gesture = null;
    g?.up(e);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', (e) => { touches.delete(e.pointerId); pinch = null; gesture = null; wiring = null; draw(); });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [x, y] = toSvg(e.clientX, e.clientY);
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, x, y);
  }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
    if (e.key === 'Escape') { pending = null; sel = {}; wiring = null; draw(); }
  });

  // ---------------------------------------------------------------- dragging parts in from the tray
  const binChip = (k: Kind) => {
    const chip = h('button', { class: 'bin-part', style: `--kc:${KIND_COLOR[k]}`, title: partInfo({ id: k, kind: k, x: 0, y: 0 }), 'aria-label': `Add a ${KIND_NAME[k]}` }, h('b', null, KIND_NAME[k]), h('small', null, 'drag or tap'));
    chip.addEventListener('pointerdown', (e) => {
      if (running || e.button > 0) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      let moved = false;
      const float = h('div', { class: 'bin-float', style: `--kc:${KIND_COLOR[k]};${themeStyle()}` }, KIND_NAME[k]);
      chip.setPointerCapture(e.pointerId);
      const overBoard = (ev: PointerEvent) => { const r = host.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; };
      const move = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
        if (!moved) { moved = true; document.body.append(float); }
        float.style.left = `${ev.clientX}px`;
        float.style.top = `${ev.clientY}px`;
        if (overBoard(ev)) {
          const [x, y] = toLocal(ev.clientX, ev.clientY);
          const [w, hh] = partSize(k);
          const gx = snap(x - w / 2), gy = snap(y - hh / 2);
          ghost = { kind: k, x: gx, y: gy, ok: fits(circ.parts, k, gx, gy, board) };
          float.classList.add('over');
        } else { ghost = null; float.classList.remove('over'); }
        draw();
      };
      const up = () => {
        chip.removeEventListener('pointermove', move);
        chip.removeEventListener('pointerup', up);
        chip.removeEventListener('pointercancel', up);
        float.remove();
        const g = ghost;
        ghost = null;
        if (!moved) addPart(k);
        else if (g) addPart(k, [g.x, g.y]);
        else draw();
      };
      chip.addEventListener('pointermove', move);
      chip.addEventListener('pointerup', up);
      chip.addEventListener('pointercancel', up);
    });
    return chip;
  };

  // ---------------------------------------------------------------- the coach line, hints and the steps drawer
  const coach = h('div', { class: 'coach', role: 'status', 'aria-live': 'polite' });
  const say = (text: string, tone: 'info' | 'warn' | 'bad' | 'ok', extra?: HTMLElement) => {
    coach.className = `coach ${tone}${text ? '' : ' empty'}`;
    coach.replaceChildren(h('span', null, text), extra ?? '');
  };
  const hintList = h('ol', { class: 'hints' });
  const hintLabel = () => (usage.hints >= level.hints.length ? 'No more hints' : `Show a hint${kind ? '' : ' (costs a star)'}`);
  const hintButtons: HTMLButtonElement[] = [];
  const hintButton = (cls = 'btn small') => { const b = h('button', { class: cls, onclick: () => showHint() }, hintLabel()) as HTMLButtonElement; hintButtons.push(b); return b; };
  const renderHints = () => {
    hintList.replaceChildren(...level.hints.slice(0, usage.hints).map((t) => h('li', null, t)));
    for (const b of hintButtons) { b.textContent = hintLabel(); b.disabled = usage.hints >= level.hints.length; }
    shortHint.disabled = headHint.disabled = usage.hints >= level.hints.length;
  };
  const showHint = () => {
    if (usage.hints >= level.hints.length) return;
    usage.hints++;
    saveDraft(`${key}.usage`, usage);
    renderHints();
    const t = level.hints[usage.hints - 1];
    say(`Hint ${usage.hints} of ${level.hints.length}: ${t}`, 'info', usage.hints < level.hints.length ? hintButton('btn small ghost') : undefined);
    renderHints();
    mentorSay(`Hint: ${t}`, 'thinking');
  };

  const drawer = h('aside', { class: 'drawer', 'aria-label': 'Steps', hidden: true },
    h('div', { class: 'drawer-head' }, h('b', null, 'How to build it'), h('button', { class: 'btn small ghost', onclick: () => toggleDrawer(false), 'aria-label': 'Close steps' }, '✕ Close')),
    h('div', { class: 'brief-body', tabindex: '0', html: level.brief }),
    h('h4', null, 'Hints'), hintList, hintButton(),
    h('h4', null, 'Controls'),
    h('ul', { class: 'controls' },
      h('li', null, 'Drag a part from the tray onto the board, or tap it to drop it in.'),
      h('li', null, 'Drag from one dot to another to wire them. Or tap one dot, then the other.'),
      h('li', null, 'Tap a switch to flip it. Tap a wire, then its ✕, to delete it.'),
      h('li', null, 'Pinch or scroll to zoom. Drag the empty board to move around. Fit shows it all.')));
  const toggleDrawer = (open?: boolean) => { drawer.hidden = open === undefined ? !drawer.hidden : !open; };

  // ---------------------------------------------------------------- the table of rows
  const rowsEl = h('div', { class: 'rows', role: 'list', 'aria-label': level.spec.kind === 'table' ? 'Every switch setting' : 'Test steps' });
  const parBox = h('div', { class: 'lab-par' });
  const renderRows = () => {
    const live = !frame && !running && level.spec.kind === 'table' ? rows.findIndex((r) => level.inputs.every((n) => r.ins[n] === inputs[n])) : -1;
    rowsEl.replaceChildren(
      h('div', { class: 'row head', 'aria-hidden': 'true' },
        h('span', { class: 'ins' }, ...level.inputs.map((n) => h('i', null, n))), h('span', { class: 'arrow' }, '→'), h('span', { class: 'outs' }, ...level.outputs.map((n) => h('i', null, n))), h('span', { class: 'mark' })),
      ...rows.map((r, i) => {
        const st = rowState[i];
        return h('div', { class: `row ${st}${i === live ? ' live' : ''}`, role: 'listitem', 'aria-label': `${r.label ? `${r.label}: ` : ''}${level.inputs.map((n) => `${n} ${r.ins[n] ? 'on' : 'off'}`).join(', ')}; ${level.outputs.map((o) => `${o} ${r.exp[o] ? 'lit' : 'off'}`).join(', ')}${st === 'ok' ? ', passed' : st === 'bad' ? ', failed' : ''}` },
          h('span', { class: 'ins' }, ...(r.label && level.spec.kind === 'seq' ? [h('em', null, r.label)] : []), ...level.inputs.map((n) => h('i', { class: r.ins[n] ? 'b1' : 'b0' }, String(r.ins[n])))),
          h('span', { class: 'arrow' }, '→'),
          h('span', { class: 'outs' }, ...level.outputs.map((o) => h('i', { class: `lamp-dot ${r.exp[o] ? 'b1' : 'b0'}`, title: `${o} should be ${r.exp[o] ? 'lit' : 'off'}` }))),
          h('span', { class: 'mark' }, st === 'ok' ? '✓' : st === 'bad' ? '✗' : st === 'cur' ? '▶' : ''));
      }));
    if (!kind) {
      const cnt = circ.parts.filter((p) => counts(p.kind)).length;
      parBox.textContent = `${level.mode === 'cmos' ? 'transistors' : 'parts'} ${cnt} · par ${level.par}`;
    }
  };

  // ---------------------------------------------------------------- the tray
  const undoBtn = h('button', { class: 'btn tool', onclick: doUndo, title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo' }, '↶') as HTMLButtonElement;
  const redoBtn = h('button', { class: 'btn tool', onclick: doRedo, title: 'Redo (Ctrl+Y)', 'aria-label': 'Redo' }, '↷') as HTMLButtonElement;
  const clearBtn = h('button', { class: 'btn tool', onclick: () => { if (running) return; sel = {}; mutate(() => { circ = clone(layout.start); }); say('Board cleared. Undo brings it back.', 'info'); } }, 'Clear') as HTMLButtonElement;
  const testBtn = h('button', { class: 'btn test-it', onclick: () => void runTest() }, '▶ Test it') as HTMLButtonElement;
  const clockBtns = hasClock ? [
    h('button', { class: 'btn tool', onclick: () => { frame = null; sim.tick(); sim.settle(inputs); draw(); say('Tick! Every DFF copied its input.', 'info'); } }, 'Clock ↑'),
    h('button', { class: 'btn tool', onclick: () => { frame = null; sim = new Sim(circ); sim.settle(inputs); draw(); say('The DFFs are back to 0.', 'info'); } }, 'Reset DFFs'),
  ] : [];
  const renderTools = () => {
    undoBtn.disabled = running || !undo.length;
    redoBtn.disabled = running || !redo.length;
    clearBtn.disabled = running;
    testBtn.disabled = running;
    testBtn.textContent = running ? 'Testing…' : '▶ Test it';
  };
  const tray = h('div', { class: 'lab-tray' },
    level.palette.length ? h('div', { class: 'lab-bin', role: 'group', 'aria-label': 'Parts' }, ...level.palette.map(binChip)) : h('div', { class: 'lab-bin empty' }, h('small', null, 'No parts to add: just wire it.')),
    clockBtns.length ? h('div', { class: 'tools' }, ...clockBtns) : '',
    testBtn);

  // ---------------------------------------------------------------- Test it, and the win
  const winCard = h('div', { class: 'win-card', hidden: true, role: 'dialog', 'aria-label': 'Circuit works' });
  const starsSlot = h('span', { class: 'head-stars' }, starEls(levelRecord(level.id)?.stars ?? 0));

  async function runTest() {
    if (running) return;
    running = true;
    attempts++;
    sel = {}; pending = null; pointAt = undefined; winCard.hidden = true;
    renderTools();
    const res = testRun(circ, level);
    const fast = reducedMotion();
    const stepMs = fast ? 0 : Math.max(260, Math.min(650, 3600 / res.frames.length));
    rowState = rows.map(() => 'idle');
    say('Testing every row…', 'info');
    for (let k = 0; k < res.frames.length; k++) {
      frame = res.frames[k];
      rowState[k] = 'cur';
      pulsing = !fast;
      draw(); renderRows();
      if (!fast) { playCue('step'); await sleep(stepMs); }
      rowState[k] = frame.ok ? 'ok' : 'bad';
      renderRows();
      if (!frame.ok) break;
    }
    pulsing = false;
    running = false;
    recordLabTest(level.id, res.ok, attempts);
    if (level.spec.kind === 'table' && frame) {
      // Leave the switches where the run stopped, so the board shows that row live.
      for (const n of level.inputs) inputs[n] = frame.inputs[n];
      sim.settle(inputs);
      frame = null;
    }
    renderTools();
    if (res.ok) { win(); draw(); renderRows(); return; }
    pointAt = res.problem?.part;
    const text = res.problem?.text ?? 'Not yet.';
    say(text, 'bad', usage.hints < level.hints.length ? hintButton('btn small') : undefined);
    renderHints();
    playCue('fail');
    mentorSay(text, 'concerned');
    draw(); renderRows();
  }

  function win() {
    const v = verify(circ, level.inputs, level.outputs, level.spec);
    const st = kind ? 3 : Math.max(1, starsFor(v, level.par) - usage.hints);
    const { gained, promotedTo } = award(level.id, level.xp, st);
    playCue(promotedTo ? 'promote' : 'pass');
    const line = pick(praise(st, level.xp)).replace(/\{name\}/g, playerName());
    setMood(st === 3 ? 'proud' : 'happy');
    mentorSay(promotedTo ? `${line} ${promotionLine(promotedTo)}` : line, promotedTo ? 'excited' : st === 3 ? 'proud' : 'happy');
    starsSlot.replaceChildren(starEls(levelRecord(level.id)?.stars ?? st));
    canvas.classList.add('won');
    setTimeout(() => canvas.classList.remove('won'), 2600);
    say('Circuit works!', 'ok');
    const next = neighbours(level.id).next;
    const notes = [
      !kind && v.count > level.par ? `You used ${v.count} parts; par is ${level.par}. Fewer parts earn more stars.` : '',
      !kind && usage.hints ? 'Solve it without hints for another star.' : '',
    ].filter(Boolean);
    winCard.replaceChildren(
      h('div', { class: 'win-kicker' }, 'Circuit works!'),
      h('h3', null, `You built ${level.made}.`),
      starEls(st),
      h('p', { class: 'gain' }, gained > 0 ? `+${gained} XP` : 'No new XP: you already have a better result here.'),
      promotedTo ? h('p', { class: 'promo' }, `Promoted to ${promotedTo.title}!`) : '',
      ...notes.map((n) => h('p', { class: 'note' }, n)),
      h('div', { class: 'win-actions' },
        next ? h('a', { class: 'btn test-it', href: next.route }, `Next: ${next.title} →`) : h('a', { class: 'btn test-it', href: '#/map' }, 'Back to the map'),
        h('button', { class: 'btn tool', onclick: () => { winCard.hidden = true; } }, 'Keep playing')));
    winCard.hidden = false;
  }

  // ---------------------------------------------------------------- the page
  const { prev, next } = neighbours(level.id);
  const headHint = h('button', { class: 'btn tool narrow', onclick: () => showHint(), title: 'Show a hint' }, 'Hint') as HTMLButtonElement;
  const head = h('header', { class: 'lab-head' },
    h('a', { class: 'crumb', href: '#/map', title: 'Back to the map' }, '◈ Map'),
    h('h2', null, level.title), starsSlot, h('span', { class: 'xp' }, `${level.xp} XP`),
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn tool narrow', onclick: () => toggleDrawer() }, 'Steps'),
    headHint,
    h('button', { class: 'btn tool peek', onclick: () => document.getElementById('desktop')?.classList.toggle('mentor-peek'), title: 'Show or hide TAPEOUT' }, 'TAPEOUT'),
    prev ? h('a', { class: 'btn tool wide', href: prev.route, title: `Back: ${prev.title}`, 'aria-label': `Back: ${prev.title}` }, '←') : '',
    next ? h('a', { class: 'btn tool wide', href: next.route, title: `Next: ${next.title}`, 'aria-label': `Next: ${next.title}` }, '→') : '');
  const shortHint = h('button', { class: 'btn tool wide', onclick: () => showHint(), title: 'Show a hint' }, 'Hint') as HTMLButtonElement;
  const goal = h('div', { class: 'goal' },
    h('span', { class: 'tag' }, level.concept),
    h('p', null, level.goal),
    h('button', { class: 'btn tool wide', onclick: () => toggleDrawer() }, 'Steps'),
    shortHint);
  const zoomTools = h('div', { class: 'zoom', role: 'group', 'aria-label': 'Zoom' },
    h('button', { class: 'btn tool', onclick: () => zoomCenter(1 / 1.25), 'aria-label': 'Zoom out' }, '−'),
    h('button', { class: 'btn tool', onclick: () => zoomCenter(1.25), 'aria-label': 'Zoom in' }, '+'),
    h('button', { class: 'btn tool', onclick: fit, 'aria-label': 'Fit the whole board' }, 'Fit'));
  const side = h('aside', { class: 'side', tabindex: '0', 'aria-label': level.spec.kind === 'table' ? 'Every switch setting' : 'Test steps' }, h('h4', null, level.spec.kind === 'table' ? 'Every switch setting' : 'Test steps'), kind ? '' : parBox, rowsEl);
  const root = h('div', { class: `lab2${kind ? ' kind' : ''}`, style: themeStyle(), 'data-lab': level.id },
    h('div', { class: 'lab2-grid' },
      head, goal,
      h('div', { class: 'main' }, h('div', { class: 'board-wrap' }, h('div', { class: 'board-bar' }, h('div', { class: 'edit', role: 'group', 'aria-label': 'Edit' }, undoBtn, redoBtn, clearBtn), zoomTools), host, coach, winCard), side),
      tray),
    drawer);

  say(circ.wires.length ? '' : level.palette.length ? 'Drag a part onto the board, then drag from dot to dot to wire it.' : 'Drag from the switch\'s dot to the lamp\'s dot to make a wire.', 'info');
  renderHints();
  renderRows();
  renderTools();
  fit();
  requestAnimationFrame(() => { tr = wantSide(); fit(); });

  // Screenshot and test hook, only when the developer flag is set in this browser.
  try {
    if (localStorage.getItem('tapeout.dev') === '1') {
      (globalThis as Record<string, unknown>).__tapeoutLab = {
        solve: () => { circ = clone(layout.solved); changed(); },
        test: () => runTest(),
      };
    }
  } catch { /* no storage: no hook */ }
  return root;
}

function gridPath(w: number, hgt: number, step: number): string {
  let d = '';
  for (let x = step; x < w; x += step) d += `M${x},0V${hgt}`;
  for (let y = step; y < hgt; y += step) d += `M0,${y}H${w}`;
  return d;
}

/** Is (x, y) on this polyline? */
function onPath(pts: [number, number][], x: number, y: number): boolean {
  for (let k = 1; k < pts.length; k++) {
    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
    if (x0 === x1 && x === x0 && y >= Math.min(y0, y1) && y <= Math.max(y0, y1)) return true;
    if (y0 === y1 && y === y0 && x >= Math.min(x0, x1) && x <= Math.max(x0, x1)) return true;
  }
  return false;
}

/** The middle of a polyline, by length. */
function midpoint(pts: [number, number][]): [number, number] {
  const seg = pts.slice(1).map((p, k) => Math.abs(p[0] - pts[k][0]) + Math.abs(p[1] - pts[k][1]));
  let half = seg.reduce((s, v) => s + v, 0) / 2;
  for (let k = 0; k < seg.length; k++) {
    if (half <= seg[k]) { const t = seg[k] ? half / seg[k] : 0; return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t]; }
    half -= seg[k];
  }
  return pts[0];
}
