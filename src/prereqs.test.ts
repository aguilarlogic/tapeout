import { describe, expect, it } from 'vitest';
import { ACTS, PLAY_ORDER } from './curriculum';
import { GROUP, PREREQS } from './prereqs';

const lessonIds = PLAY_ORDER.filter((m) => m.kind === 'lesson').map((m) => m.id);
const at = new Map(PLAY_ORDER.map((m, i) => [m.id, i]));

describe('the prerequisite graph', () => {
  it('PLAY_ORDER holds every module exactly once', () => {
    const all = ACTS.flatMap((a) => a.chapters.flatMap((c) => c.modules.map((m) => m.id))).sort();
    expect(PLAY_ORDER.map((m) => m.id).sort()).toEqual(all);
  });

  it('lists every lesson, and only lessons', () => {
    expect(lessonIds.filter((id) => !PREREQS[id])).toEqual([]);
    expect(Object.keys(PREREQS).filter((id) => !lessonIds.includes(id))).toEqual([]);
  });

  it('only names lessons that exist as needs', () => {
    const bad = Object.entries(PREREQS).flatMap(([id, p]) => p.needs.filter((n) => !PREREQS[n] || n === id).map((n) => `${id} → ${n}`));
    expect(bad).toEqual([]);
  });

  it('has no cycles', () => {
    const state = new Map<string, 'open' | 'done'>();
    const cycles: string[] = [];
    const visit = (id: string, path: string[]) => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'open') { cycles.push([...path, id].join(' → ')); return; }
      state.set(id, 'open');
      for (const n of PREREQS[id]?.needs ?? []) visit(n, [...path, id]);
      state.set(id, 'done');
    };
    for (const id of Object.keys(PREREQS)) visit(id, []);
    expect(cycles).toEqual([]);
  });

  it('puts every lesson after everything it needs', () => {
    const late = Object.entries(PREREQS).flatMap(([id, p]) => p.needs.filter((n) => at.get(n)! > at.get(id)!).map((n) => `${id} comes before its need ${n}`));
    expect(late).toEqual([]);
  });
});

describe('one subject at a time', () => {
  it('teaches one subject per chapter', () => {
    const mixed = ACTS.filter((a) => a.kind !== 'roles').flatMap((a) => a.chapters).flatMap((c) => {
      const subjects = new Set(c.modules.filter((m) => m.kind === 'lesson').map((m) => PREREQS[m.id].subject));
      return subjects.size > 1 ? [`${c.name}: ${[...subjects].join(', ')}`] : [];
    });
    expect(mixed).toEqual([]);
  });

  it('never mixes digital design, circuit theory and device physics in one act', () => {
    const mixed = ACTS.filter((a) => a.kind !== 'roles').flatMap((a) => {
      // A side step that names a `need` is called in from outside the act's own chapters (the ADA-1 electricity primer).
      const groups = new Set(a.chapters.filter((c) => a.kind === 'detour' || !c.need).flatMap((c) => c.modules)
        .filter((m) => m.kind === 'lesson').map((m) => GROUP[PREREQS[m.id].subject]).filter(Boolean));
      return groups.size > 1 ? [`${a.name}: ${[...groups].join(', ')}`] : [];
    });
    expect(mixed).toEqual([]);
  });

  it('meets the theory stages S4 to S11 in order, all before the transistor chapter', () => {
    const stages = ACTS.flatMap((a) => a.chapters).filter((c) => c.stage !== undefined && c.stage >= 4);
    const firstAt = (name: string) => at.get(ACTS.flatMap((a) => a.chapters).find((c) => c.name === name)!.modules[0].id)!;
    const order = [...stages].sort((x, y) => firstAt(x.name) - firstAt(y.name)).map((c) => c.stage);
    expect(order).toEqual([...order].sort((x, y) => x! - y!));
    const transistors = firstAt('Transistors');
    for (const c of stages) expect(firstAt(c.name), c.name).toBeLessThan(transistors);
  });

  it('teaches electricity before anything that uses volts, and keeps it off the chip path', () => {
    const primer = ACTS[0].chapters.find((c) => c.name === 'Electricity')!;
    expect(primer.need).toBe('Numbers');
    expect(at.get('electricity')!).toBeLessThan(at.get('bitadd')!);
  });
});

describe('missing prerequisites at runtime', () => {
  it('lists the needs not yet done, and none once they are', async () => {
    const { missingNeeds, PREREQS } = await import('./prereqs');
    const id = Object.keys(PREREQS).find((k) => PREREQS[k].needs.length >= 1)!;
    expect(missingNeeds(id, () => false)).toEqual(PREREQS[id].needs);
    expect(missingNeeds(id, () => true)).toEqual([]);
    expect(missingNeeds('no-such-lesson', () => false)).toEqual([]);
  });
});
