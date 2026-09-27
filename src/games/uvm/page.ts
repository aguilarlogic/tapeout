import { mentorSay } from '../../os/mentor';
import { complete, levelRecord } from '../../state';
import { h, svg, toast } from '../../ui/dom';
import { celebrate, levelHeader, nextHref } from '../../ui/layout';
import { ArchPuzzle, CodePuzzle, OrderPuzzle, UVM_PUZZLES } from './puzzles';

export function uvmPage(id: string): HTMLElement {
  const pz = UVM_PUZZLES.find((p) => p.id === id);
  if (!pz) return h('p', null, 'Unknown puzzle.');
  let mistakes = 0;
  const finish = () => {
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    const gained = complete(pz.id, pz.xp, stars);
    celebrate(stars, gained, mistakes ? [`${mistakes} wrong attempt${mistakes > 1 ? 's' : ''} - a perfect run earns 3 stars.`] : [], nextHref(pz.id));
  };
  const miss = () => { mistakes++; if (mistakes === 3) mentorSay('Three misses. Think about who talks to whom: sequences make items, drivers drive pins, monitors only watch.', 'thinking'); };

  const body = pz.kind === 'arch' ? archView(pz, miss, finish) : pz.kind === 'order' ? orderView(pz, miss, finish) : codeView(pz, miss, finish);

  return h('div', { class: 'level' },
    levelHeader(pz.title, pz.id, levelRecord(pz.id)?.stars ?? 0, pz.xp),
    h('div', { class: 'level-grid' },
      h('aside', { class: 'brief panel' }, h('div', { class: 'tag' }, pz.concept), h('div', { class: 'brief-body', html: pz.brief })),
      h('section', { class: 'work panel' }, body),
    ),
  );
}

function archView(pz: ArchPuzzle, miss: () => void, finish: () => void): HTMLElement {
  const placed: Record<string, string> = {};
  let picked: string | null = null;
  const palette = h('div', { class: 'palette' });
  const diagram = h('div', { class: 'uvm-diagram' });
  const info = h('p', { class: 'dim' }, 'Pick a component, then click its slot.');

  const renderPalette = () => {
    palette.replaceChildren(...pz.palette.map((c) => {
      const used = Object.values(placed).includes(c.id);
      return h('button', {
        class: `chip${picked === c.id ? ' on' : ''}${used ? ' used' : ''}`,
        disabled: used,
        title: c.tip,
        onclick: () => { picked = c.id; info.textContent = c.tip; renderPalette(); },
      }, c.label);
    }));
  };

  const renderDiagram = () => {
    diagram.replaceChildren();
    const lines = svg('svg', { class: 'uvm-wires', viewBox: '0 0 100 100', preserveAspectRatio: 'none' });
    const center = (sid: string) => {
      const s = pz.slots.find((x) => x.id === sid)!;
      return [s.x + s.w / 2, s.y + s.h / 2];
    };
    const allPlaced = pz.slots.every((s) => placed[s.id]);
    if (allPlaced) {
      for (const w of pz.wires) {
        const [x1, y1] = center(w.from), [x2, y2] = center(w.to);
        lines.append(svg('line', { x1, y1, x2, y2, 'vector-effect': 'non-scaling-stroke' }));
      }
    }
    diagram.append(lines);
    for (const s of pz.slots) {
      const comp = pz.palette.find((c) => c.id === placed[s.id]);
      const isParent = pz.slots.some((c) => c.parent === s.id);
      const el = h('div', {
        class: `slot${comp ? ' filled' : ''}${isParent ? ' container' : ''}`,
        style: `left:${s.x}%;top:${s.y}%;width:${s.w}%;height:${s.h}%`,
        onclick: (ev: Event) => {
          ev.stopPropagation();
          if (!picked) { toast('Pick a component from the palette first.', 'info'); return; }
          if (placed[s.id]) return;
          if (pz.palette.find((c) => c.id === picked)!.id !== s.answer) {
            miss();
            toast(`${pz.palette.find((c) => c.id === picked)!.label} doesn't belong there.`, 'err');
            return;
          }
          placed[s.id] = picked;
          picked = null;
          renderPalette();
          renderDiagram();
          if (pz.slots.every((x) => placed[x.id])) {
            info.innerHTML = 'Testbench assembled. The wires show the TLM connections: <code>seq_item_port</code> pulls from the sequencer; the monitor\'s <code>analysis_port</code> broadcasts to every subscriber (one write, many readers).';
            setTimeout(finish, 600);
          }
        },
      }, h('span', { class: 'slot-label' }, comp ? comp.label : '?'));
      diagram.append(el);
    }
    if (allPlaced) {
      for (const w of pz.wires) {
        const [x1, y1] = center(w.from), [x2, y2] = center(w.to);
        diagram.append(h('span', { class: 'wire-label', style: `left:${(x1 + x2) / 2}%;top:${(y1 + y2) / 2}%` }, w.label));
      }
    }
  };
  renderPalette();
  renderDiagram();
  return h('div', null, h('h4', null, 'Components'), palette, info, diagram);
}

function orderView(pz: OrderPuzzle, miss: () => void, finish: () => void): HTMLElement {
  const shuffled = [...pz.items].sort((a, b) => hash(a.id) - hash(b.id));
  const chosen: string[] = [];
  const pool = h('div', { class: 'palette' });
  const list = h('ol', { class: 'phase-list' });
  const render = () => {
    pool.replaceChildren(...shuffled.map((it) => h('button', {
      class: `chip${chosen.includes(it.id) ? ' used' : ''}`,
      disabled: chosen.includes(it.id),
      onclick: () => {
        const expected = pz.items[chosen.length];
        if (it.id !== expected.id) { miss(); toast(`Not yet - something else runs before ${it.label}.`, 'err'); return; }
        chosen.push(it.id);
        render();
        if (chosen.length === pz.items.length) setTimeout(finish, 500);
      },
    }, it.label)));
    list.replaceChildren(...chosen.map((cid) => {
      const it = pz.items.find((x) => x.id === cid)!;
      return h('li', null, h('code', null, it.label), h('span', { class: 'dim' }, ` - ${it.note}`));
    }));
  };
  render();
  return h('div', null, h('h4', null, 'Phases (click in execution order)'), pool, list);
}

function codeView(pz: CodePuzzle, miss: () => void, finish: () => void): HTMLElement {
  const picks: (string | null)[] = pz.blanks.map(() => null);
  const mirrors: HTMLElement[][] = pz.blanks.map(() => []);
  const pre = h('pre', { class: 'code-puzzle' });
  const parts = pz.code.split(/(\{\{\d+\}\})/);
  const seen = new Set<number>();
  for (const part of parts) {
    const m = /^\{\{(\d+)\}\}$/.exec(part);
    if (!m) { pre.append(part); continue; }
    const i = parseInt(m[1]);
    if (seen.has(i)) {
      const span = h('span', { class: 'mirror' }, '____');
      mirrors[i].push(span);
      pre.append(span);
      continue;
    }
    seen.add(i);
    const sel = h('select', { class: 'blank', 'aria-label': `Blank ${i + 1}` },
      h('option', { value: '' }, '____'),
      ...pz.blanks[i].options.map((o) => h('option', { value: o }, o))) as HTMLSelectElement;
    sel.addEventListener('change', () => {
      picks[i] = sel.value || null;
      sel.classList.remove('right', 'wrong');
      mirrors[i].forEach((s) => (s.textContent = sel.value || '____'));
    });
    pre.append(sel);
  }
  const feedback = h('ul', { class: 'messages' });
  const check = () => {
    if (picks.some((p) => p === null)) { toast('Fill in every blank first.', 'info'); return; }
    const selects = [...pre.querySelectorAll('select')] as HTMLSelectElement[];
    feedback.replaceChildren();
    let wrong = 0;
    pz.blanks.forEach((b, i) => {
      const ok = picks[i] === b.answer;
      selects[i].classList.toggle('right', ok);
      selects[i].classList.toggle('wrong', !ok);
      if (!ok) { wrong++; feedback.append(h('li', { class: 'msg err' }, `Blank ${i + 1}: '${picks[i]}' isn't right.`)); }
    });
    if (wrong) { miss(); return; }
    feedback.append(...pz.blanks.map((b, i) => h('li', { class: 'msg ok' }, h('b', null, `${i + 1}. ${b.answer}`), ` - ${b.why}`)));
    setTimeout(finish, 400);
  };
  return h('div', null,
    h('div', { class: 'toolbar' }, h('span', { class: 'spacer' }), h('button', { class: 'btn primary', onclick: check }, 'Compile & check')),
    pre, feedback);
}

function hash(s: string) {
  let x = 7;
  for (const c of s) x = (x * 31 + c.charCodeAt(0)) % 9973;
  return x;
}
