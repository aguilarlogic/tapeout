import { afterEach, describe, expect, it, vi } from 'vitest';
import { busyWhile } from './labkit';

// The test environment has no DOM, so the two elements the busy state touches are stood in for by plain objects.
function fakeUi() {
  const attrs = new Map<string, string>();
  const status = {
    className: 'status idle',
    textContent: 'Ready',
    setAttribute: (k: string, v: string) => { attrs.set(k, v); },
    removeAttribute: (k: string) => { attrs.delete(k); },
  } as unknown as HTMLElement;
  const buttons = [{ disabled: false }, { disabled: false }] as unknown as HTMLButtonElement[];
  return { status, buttons, ariaBusy: () => attrs.get('aria-busy') };
}

describe('busyWhile', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('shows the busy state before the check starts and clears it after', async () => {
    vi.useFakeTimers();
    const ui = fakeUi();
    let during: { disabled: boolean[]; text: string; busy: string | undefined } | undefined;
    const done = busyWhile({ buttons: ui.buttons, status: ui.status }, () => {
      during = { disabled: ui.buttons.map((b) => b.disabled), text: ui.status.textContent ?? '', busy: ui.ariaBusy() };
    });
    // Set synchronously, before the check yields to the browser.
    expect(ui.buttons.map((b) => b.disabled)).toEqual([true, true]);
    expect(ui.status.textContent).toBe('Checking…');
    expect(ui.ariaBusy()).toBe('true');
    expect(during).toBeUndefined();
    await vi.runAllTimersAsync();
    await done;
    expect(during).toEqual({ disabled: [true, true], text: 'Checking…', busy: 'true' });
    expect(ui.buttons.map((b) => b.disabled)).toEqual([false, false]);
    expect(ui.ariaBusy()).toBeUndefined();
  });

  it('clears the busy state and reports the error when the check throws', async () => {
    vi.useFakeTimers();
    const ui = fakeUi();
    const done = busyWhile({ buttons: ui.buttons, status: ui.status }, () => { throw new Error('boom'); });
    const settled = expect(done).rejects.toThrow('boom');
    await vi.runAllTimersAsync();
    await settled;
    expect(ui.buttons.map((b) => b.disabled)).toEqual([false, false]);
    expect(ui.ariaBusy()).toBeUndefined();
    expect(ui.status.className).toBe('status err');
    expect(ui.status.textContent).toBe('The check stopped: boom');
  });

  it('ignores a second press while a check is running', async () => {
    vi.useFakeTimers();
    const ui = fakeUi();
    let calls = 0;
    const first = busyWhile({ buttons: ui.buttons, status: ui.status }, () => { calls++; });
    const second = busyWhile({ buttons: ui.buttons, status: ui.status }, () => { calls++; });
    await vi.runAllTimersAsync();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(ui.buttons.map((b) => b.disabled)).toEqual([false, false]);
  });

  it('can start again once the previous check has finished', async () => {
    vi.useFakeTimers();
    const ui = fakeUi();
    let calls = 0;
    const run = () => busyWhile({ buttons: ui.buttons, status: ui.status }, () => { calls++; });
    const a = run();
    await vi.runAllTimersAsync();
    await a;
    const b = run();
    await vi.runAllTimersAsync();
    await b;
    expect(calls).toBe(2);
  });
});
