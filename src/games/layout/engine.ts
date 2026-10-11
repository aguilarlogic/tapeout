// A tiny layout system: rectangles on process layers, a design-rule checker, a connectivity and device extractor, and
// a layout-versus-schematic comparison.  Units are grid squares; rectangles are half-open [x1,x2) × [y1,y2).
export type Layer = 'nwell' | 'ndiff' | 'pdiff' | 'poly' | 'contact' | 'm1';
export const LAYERS: Layer[] = ['nwell', 'ndiff', 'pdiff', 'poly', 'contact', 'm1'];
export interface Rect { layer: Layer; x1: number; y1: number; x2: number; y2: number; label?: string; line: number }

export class LayoutError extends Error { constructor(msg: string, public line: number) { super(msg); } }

export function parseLayout(text: string): Rect[] {
  const out: Rect[] = [];
  text.split('\n').forEach((raw, i) => {
    const l = raw.replace(/#.*$/, '').trim();
    if (!l) return;
    const m = /^(\w+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)(?:\s+(\w+))?$/.exec(l);
    if (!m) throw new LayoutError(`cannot read "${l}": use  layer x1 y1 x2 y2 [label]`, i + 1);
    if (!LAYERS.includes(m[1] as Layer)) throw new LayoutError(`unknown layer "${m[1]}" (layers: ${LAYERS.join(', ')})`, i + 1);
    const [x1, y1, x2, y2] = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
    if (x2 <= x1 || y2 <= y1) throw new LayoutError('a rectangle needs x2 > x1 and y2 > y1', i + 1);
    if (m[6] && m[1] !== 'm1') throw new LayoutError('only metal1 shapes carry a net label', i + 1);
    out.push({ layer: m[1] as Layer, x1, y1, x2, y2, label: m[6], line: i + 1 });
  });
  return out;
}

const w = (r: Rect) => r.x2 - r.x1, h = (r: Rect) => r.y2 - r.y1;
const ovArea = (a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
const touch = (a: Rect, b: Rect) => { // overlap or share an edge segment
  const gx = Math.max(a.x1, b.x1) - Math.min(a.x2, b.x2), gy = Math.max(a.y1, b.y1) - Math.min(a.y2, b.y2);
  return (gx < 0 && gy <= 0) || (gy < 0 && gx <= 0);
};
const gap = (a: Rect, b: Rect) => {
  const gx = Math.max(a.x1, b.x1) - Math.min(a.x2, b.x2), gy = Math.max(a.y1, b.y1) - Math.min(a.y2, b.y2);
  return gx <= 0 && gy <= 0 ? 0 : Math.max(gx, gy);
};

export interface Violation { rule: string; line: number; detail: string }

const MIN_WIDTH: Partial<Record<Layer, number>> = { poly: 2, ndiff: 3, pdiff: 3, m1: 3, nwell: 6 };
const MIN_SPACE: Partial<Record<Layer, number>> = { poly: 3, ndiff: 3, pdiff: 3, m1: 3, contact: 3, nwell: 4 };

export function drc(rects: Rect[]): Violation[] {
  const v: Violation[] = [];
  const by = (l: Layer) => rects.filter((r) => r.layer === l);
  const add = (rule: string, r: Rect, detail: string) => v.push({ rule, line: r.line, detail });
  for (const r of rects) {
    const mw = MIN_WIDTH[r.layer];
    if (mw && Math.min(w(r), h(r)) < mw) add(`${r.layer} min width ${mw}`, r, `${r.layer} at line ${r.line} is ${w(r)}×${h(r)}`);
    if (r.layer === 'contact' && (w(r) !== 2 || h(r) !== 2)) add('contact must be 2×2', r, `contact at line ${r.line} is ${w(r)}×${h(r)}`);
  }
  for (const l of Object.keys(MIN_SPACE) as Layer[]) {
    const rs = by(l);
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const g = gap(rs[i], rs[j]);
      if (g > 0 && g < MIN_SPACE[l]!) add(`${l} spacing ${MIN_SPACE[l]}`, rs[j], `${l} shapes at lines ${rs[i].line} and ${rs[j].line} are ${g} apart`);
    }
  }
  for (const a of by('ndiff')) for (const b of by('pdiff')) {
    if (ovArea(a, b) > 0) add('ndiff and pdiff overlap', b, `lines ${a.line} and ${b.line}`);
    else if (gap(a, b) < 4) add('ndiff–pdiff spacing 4', b, `lines ${a.line} and ${b.line} are ${gap(a, b)} apart`);
  }
  for (const d of by('ndiff')) for (const nw of by('nwell')) {
    if (ovArea(d, nw) > 0) add('ndiff inside nwell', d, `ndiff at line ${d.line} overlaps the nwell`);
    else if (gap(d, nw) < 2) add('nwell–ndiff spacing 2', d, `ndiff at line ${d.line} is ${gap(d, nw)} from the nwell`);
  }
  for (const d of by('pdiff')) {
    const ok = by('nwell').some((nw) => nw.x1 <= d.x1 - 2 && nw.y1 <= d.y1 - 2 && nw.x2 >= d.x2 + 2 && nw.y2 >= d.y2 + 2);
    if (!ok) add('nwell must enclose pdiff by 2', d, `pdiff at line ${d.line}`);
  }
  const encl = (c: Rect, outer: Rect[], m: number) => outer.some((o) => o.x1 <= c.x1 - m && o.y1 <= c.y1 - m && o.x2 >= c.x2 + m && o.y2 >= c.y2 + m);
  for (const c of by('contact')) {
    const diffs = [...by('ndiff'), ...by('pdiff')], polys = by('poly');
    const onD = diffs.some((d) => ovArea(c, d) > 0), onP = polys.some((p) => ovArea(c, p) > 0);
    if (onD && onP) add('contact on both poly and diffusion', c, `line ${c.line}`);
    else if (!onD && !onP) add('contact must land on poly or diffusion', c, `line ${c.line}`);
    else if (onD && !encl(c, diffs, 1)) add('diffusion must enclose contact by 1', c, `contact at line ${c.line}`);
    else if (onP && !encl(c, polys, 1)) add('poly must enclose contact by 1', c, `contact at line ${c.line}`);
    if (!encl(c, by('m1'), 1)) add('metal1 must enclose contact by 1', c, `contact at line ${c.line}`);
  }
  // gates: poly crossing diffusion
  for (const d of [...by('ndiff'), ...by('pdiff')]) {
    const gates = by('poly').filter((p) => ovArea(p, d) > 0).sort((a, b) => a.x1 - b.x1);
    for (const p of gates) {
      if (p.y1 > d.y1 || p.y2 < d.y2) { add('poly must fully cross the diffusion', p, `poly at line ${p.line} does not span the diffusion at line ${d.line}`); continue; }
      if (p.y1 > d.y1 - 2 || p.y2 < d.y2 + 2) add('poly must extend 2 past the diffusion', p, `end cap of the poly at line ${p.line}`);
    }
    const spans = gates.map((p) => [Math.max(p.x1, d.x1), Math.min(p.x2, d.x2)] as [number, number]);
    let prev = d.x1;
    for (const [a, b] of spans) { if (a - prev < 4) add('source/drain region needs 4 width', d, `region left of the gate at x=${a} in the diffusion at line ${d.line} is ${a - prev} wide`); prev = b; }
    if (spans.length && d.x2 - prev < 4) add('source/drain region needs 4 width', d, `last region of the diffusion at line ${d.line} is ${d.x2 - prev} wide`);
  }
  return v;
}

// ------------------------------------------------------------ extraction and LVS
export interface Device { type: 'n' | 'p'; gate: string; a: string; b: string }
export interface Extracted { devices: Device[]; problems: string[]; nets: Map<string, number> }

export function extract(rects: Rect[]): Extracted {
  const nodes: { kind: string; r: Rect }[] = [];
  const parent: number[] = [];
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => { parent[find(a)] = find(b); };
  const mk = (kind: string, r: Rect) => { nodes.push({ kind, r }); parent.push(parent.length); return nodes.length - 1; };
  const polyIds = rects.filter((r) => r.layer === 'poly').map((r) => mk('poly', r));
  const m1Ids = rects.filter((r) => r.layer === 'm1').map((r) => mk('m1', r));
  // split diffusion at every gate
  const devices: { type: 'n' | 'p'; gate: number; a: number; b: number }[] = [];
  const diffPieces: number[] = [];
  for (const d of rects.filter((r) => r.layer === 'ndiff' || r.layer === 'pdiff')) {
    const gates = polyIds.filter((id) => ovArea(nodes[id].r, d) > 0).sort((a, b) => nodes[a].r.x1 - nodes[b].r.x1);
    const pieces: number[] = [];
    let prev = d.x1;
    const cuts = gates.map((g) => [Math.max(nodes[g].r.x1, d.x1), Math.min(nodes[g].r.x2, d.x2)] as [number, number]);
    for (const [a, b] of cuts) { if (a > prev) pieces.push(mk(d.layer, { ...d, x1: prev, x2: a })); else pieces.push(mk(d.layer, { ...d, x1: prev, x2: prev + 0.0001 })); prev = b; }
    if (d.x2 > prev) pieces.push(mk(d.layer, { ...d, x1: prev, x2: d.x2 })); else pieces.push(mk(d.layer, { ...d, x1: prev, x2: prev + 0.0001 }));
    diffPieces.push(...pieces);
    gates.forEach((g, i) => devices.push({ type: d.layer === 'ndiff' ? 'n' : 'p', gate: g, a: pieces[i], b: pieces[i + 1] }));
  }
  for (let i = 0; i < polyIds.length; i++) for (let j = i + 1; j < polyIds.length; j++) if (touch(nodes[polyIds[i]].r, nodes[polyIds[j]].r)) union(polyIds[i], polyIds[j]);
  for (let i = 0; i < m1Ids.length; i++) for (let j = i + 1; j < m1Ids.length; j++) if (touch(nodes[m1Ids[i]].r, nodes[m1Ids[j]].r)) union(m1Ids[i], m1Ids[j]);
  for (const c of rects.filter((r) => r.layer === 'contact')) {
    const hit = [...polyIds, ...m1Ids, ...diffPieces].filter((id) => ovArea(nodes[id].r, c) > 0);
    for (let i = 1; i < hit.length; i++) union(hit[0], hit[i]);
  }
  // names
  const labels = new Map<number, Set<string>>();
  for (const id of m1Ids) { const l = nodes[id].r.label; if (l) { const root = find(id); (labels.get(root) ?? labels.set(root, new Set()).get(root)!).add(l); } }
  const problems: string[] = [];
  const name = (id: number): string => { const ls = labels.get(find(id)); return ls && ls.size ? [...ls].sort()[0] : `?${find(id)}`; };
  for (const [root, ls] of labels) if (ls.size > 1) problems.push(`short: nets ${[...ls].join(' and ')} are connected (metal/contact at net ${root})`);
  const where = new Map<string, Set<number>>();
  for (const [root, ls] of labels) for (const l of ls) (where.get(l) ?? where.set(l, new Set()).get(l)!).add(root);
  for (const [l, roots] of where) if (roots.size > 1) problems.push(`open: net ${l} is split into ${roots.size} pieces that are not connected`);
  const nets = new Map<string, number>();
  for (const id of nodes.keys()) nets.set(name(id), (nets.get(name(id)) ?? 0) + 1);
  return { devices: devices.map((d) => ({ type: d.type, gate: name(d.gate), a: name(d.a), b: name(d.b) })), problems, nets };
}

/** compare extracted devices with the schematic; internal nets of the schematic are named with a leading '_' and may match any net */
export function lvs(ex: Extracted, schematic: Device[]): string[] {
  const issues = [...ex.problems];
  if (ex.devices.length !== schematic.length) { issues.push(`the layout has ${ex.devices.length} transistor(s), the schematic ${schematic.length}`); return issues; }
  const canon = (d: Device) => ({ ...d, sd: [d.a, d.b].sort() });
  const exd = ex.devices.map(canon);
  const used = new Array(exd.length).fill(false);
  const map = new Map<string, string>();
  const eq = (s: string, e: string, m: Map<string, string>): Map<string, string> | null => {
    if (!s.startsWith('_')) return s === e ? m : null;
    const cur = m.get(s);
    if (cur !== undefined) return cur === e ? m : null;
    if (e.startsWith('?') || true) { for (const v of m.values()) if (v === e) return null; const n = new Map(m); n.set(s, e); return n; }
    return null;
  };
  const solve = (i: number, m: Map<string, string>): boolean => {
    if (i === schematic.length) return true;
    const s = schematic[i];
    for (let j = 0; j < exd.length; j++) {
      if (used[j] || exd[j].type !== s.type) continue;
      for (const [x, y] of [[exd[j].a, exd[j].b], [exd[j].b, exd[j].a]]) {
        const m1 = eq(s.gate, exd[j].gate, m); if (!m1) continue;
        const m2 = eq(s.a, x, m1); if (!m2) continue;
        const m3 = eq(s.b, y, m2); if (!m3) continue;
        used[j] = true;
        if (solve(i + 1, m3)) { m3.forEach((v, k) => map.set(k, v)); return true; }
        used[j] = false;
      }
    }
    return false;
  };
  if (!solve(0, new Map())) {
    issues.push('the extracted devices do not match the schematic: ' + (ex.devices.map((d) => `${d.type.toUpperCase()}MOS gate ${d.gate.startsWith('?') ? '(unlabelled)' : d.gate}, terminals ${[d.a, d.b].map((x) => (x.startsWith('?') ? '(unlabelled)' : x)).join('/')}`).join('; ') || 'no transistors'));
  }
  return issues;
}

export const bbox = (rs: Rect[]) => rs.length ? { x1: Math.min(...rs.map((r) => r.x1)), y1: Math.min(...rs.map((r) => r.y1)), x2: Math.max(...rs.map((r) => r.x2)), y2: Math.max(...rs.map((r) => r.y2)) } : { x1: 0, y1: 0, x2: 0, y2: 0 };

export function render(rects: Rect[], pad = 1): { t: string; c?: string }[][] {
  const b = bbox(rects);
  const rows: { t: string; c?: string }[][] = [];
  const order: Layer[] = ['nwell', 'ndiff', 'pdiff', 'poly', 'contact', 'm1'];
  const style: Record<Layer, [string, string]> = { nwell: ['·', 'lw'], ndiff: ['n', 'ln'], pdiff: ['p', 'lpd'], poly: ['P', 'lp'], contact: ['■', 'lc'], m1: ['M', 'lm1'] };
  for (let y = b.y1 - pad; y < b.y2 + pad; y++) {
    const row: { t: string; c?: string }[] = [];
    for (let x = b.x1 - pad; x < b.x2 + pad; x++) {
      let cell: { t: string; c?: string } = { t: ' ' };
      for (const l of order) {
        const top = rects.filter((r) => r.layer === l && x >= r.x1 && x < r.x2 && y >= r.y1 && y < r.y2);
        if (top.length) cell = { t: style[l][0], c: style[l][1] };
      }
      // draw the contact over the metal, the metal over the rest (m1 wins unless a contact is on top)
      const hasM = rects.some((r) => r.layer === 'm1' && x >= r.x1 && x < r.x2 && y >= r.y1 && y < r.y2);
      const hasC = rects.some((r) => r.layer === 'contact' && x >= r.x1 && x < r.x2 && y >= r.y1 && y < r.y2);
      if (hasC) cell = { t: '■', c: 'lc' }; else if (hasM) cell = { t: 'M', c: 'lm1' };
      row.push(cell);
    }
    rows.push(row);
  }
  return rows;
}
