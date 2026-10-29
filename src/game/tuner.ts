// The F3 tuning panel (plan M, decision 27): sliders for the Pulse Probe, Charged Probe, Field Coil, feedback and
// camera numbers in TUNING, live; "Copy values" copies only the numbers changed from the shipped ones, as JSON, so b
// can paste them back. Also "Repair a panel", "Break panels" and "Stress test" (decision 28). Works in every build.
import { h } from '../ui/dom';
import { TUNING, TUNING_DEFAULTS } from './tuning';

type Group = 'probe' | 'charged' | 'field' | 'feel' | 'camera';
/** [group, key, min, max, step] for every slider. */
const SLIDERS: [Group, string, number, number, number][] = [
  ['probe', 'rate', 1, 20, 0.5], ['probe', 'speed', 300, 2400, 50], ['probe', 'life', 0.2, 2, 0.05], ['probe', 'spread', 0, 10, 0.25],
  ['probe', 'damage', 1, 50, 1], ['probe', 'bufferMs', 0, 300, 10], ['probe', 'knock', 0, 400, 10], ['probe', 'shake', 0, 6, 0.5], ['probe', 'aimLine', 0, 300, 10],
  ['charged', 'chargeS', 0.2, 2, 0.05], ['charged', 'damage', 5, 120, 5], ['charged', 'pierce', 1, 8, 1], ['charged', 'speed', 300, 2400, 50], ['charged', 'energy', 0, 60, 5],
  ['field', 'arc', 30, 240, 5], ['field', 'radius', 40, 200, 5], ['field', 'drain', 0, 50, 1], ['field', 'drainHold', 0, 60, 1],
  ['field', 'pushSpeed', 0, 1200, 25], ['field', 'pushCost', 0, 40, 1], ['field', 'reflect', 0.2, 2, 0.05], ['field', 'grabLimit', 0.5, 10, 0.5],
  ['field', 'holdDist', 30, 140, 5], ['field', 'stiffness', 0.02, 0.6, 0.01], ['field', 'damping', 0, 0.6, 0.01],
  ['field', 'chargeS', 0.2, 2, 0.05], ['field', 'throwMin', 100, 1500, 50], ['field', 'throwBonus', 0, 2000, 50], ['field', 'throwDamage', 0, 0.1, 0.005],
  ['feel', 'hitStopMs', 0, 120, 5], ['feel', 'killShake', 0, 10, 0.5], ['feel', 'killShakeMs', 0, 400, 10], ['feel', 'hitFlashMs', 0, 200, 10], ['feel', 'recoil', 0, 10, 0.5],
  ['camera', 'follow', 0.02, 0.5, 0.01], ['camera', 'lookahead', 0, 0.6, 0.02], ['camera', 'lookMax', 0, 300, 10],
];

export interface TunerHooks { repair(): void; breakPanels(): void; stress(): void }

export class Tuner {
  el: HTMLElement | null = null;
  constructor(private parent: HTMLElement, private hooks: TunerHooks) {}

  get open() { return this.el !== null; }

  toggle() {
    if (this.el) { this.close(); return; }
    const status = h('div', { class: 'gm-status', role: 'status' }, '');
    const groups = new Map<Group, HTMLElement[]>();
    for (const [g, key, min, max, step] of SLIDERS) {
      const cur = (TUNING[g] as Record<string, number>)[key];
      const out = h('output', null, fmt(cur));
      const input = h('input', { type: 'range', min: `${min}`, max: `${max}`, step: `${step}`, value: `${cur}`, 'aria-label': `${g} ${key}` }) as HTMLInputElement;
      input.addEventListener('input', () => {
        (TUNING[g] as Record<string, number>)[key] = Number(input.value);
        out.textContent = fmt(Number(input.value));
        row.classList.toggle('changed', Number(input.value) !== (TUNING_DEFAULTS[g] as Record<string, number>)[key]);
      });
      const row = h('label', { class: `gm-slider small${cur !== (TUNING_DEFAULTS[g] as Record<string, number>)[key] ? ' changed' : ''}` }, h('span', null, key), input, out);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(row);
    }
    const copy = async () => {
      const diff: Record<string, Record<string, number>> = {};
      for (const [g, key] of SLIDERS) {
        const v = (TUNING[g] as Record<string, number>)[key], d = (TUNING_DEFAULTS[g] as Record<string, number>)[key];
        if (v !== d) (diff[g] ??= {})[key] = v;
      }
      const text = JSON.stringify(diff, null, 2);
      try { await navigator.clipboard.writeText(text); status.textContent = Object.keys(diff).length ? 'Copied the changed values.' : 'Nothing changed yet; copied {}.'; }
      catch { status.textContent = text; }
    };
    const reset = () => {
      for (const [g, key] of SLIDERS) (TUNING[g] as Record<string, number>)[key] = (TUNING_DEFAULTS[g] as Record<string, number>)[key];
      this.close();
      this.toggle();
    };
    this.el = h('aside', { class: 'gm-tuner', 'aria-label': 'Tuning panel' },
      h('div', { class: 'gm-tuner-head' }, h('strong', null, 'TUNING  (F3)'),
        h('button', { class: 'gm-btn mini', onclick: copy }, 'Copy values'),
        h('button', { class: 'gm-btn mini', onclick: reset }, 'Reset')),
      status,
      h('div', { class: 'gm-row wrap' },
        h('button', { class: 'gm-btn mini', onclick: () => this.hooks.repair() }, 'Repair a panel'),
        h('button', { class: 'gm-btn mini', onclick: () => this.hooks.breakPanels() }, 'Break panels'),
        h('button', { class: 'gm-btn mini', onclick: () => this.hooks.stress() }, 'Stress test')),
      ...[...groups].map(([g, rows]) => h('fieldset', null, h('legend', null, g), ...rows)));
    // keep clicks on the panel from reaching the game
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.parent.append(this.el);
  }

  close() {
    this.el?.remove();
    this.el = null;
  }
}

const fmt = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(Math.abs(v) < 1 ? 3 : 2));
