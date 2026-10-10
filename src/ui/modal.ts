// The in-OS confirm dialog: replaces the browser's confirm() everywhere, so the fiction holds and keys behave.
import { h } from './dom';

export interface ConfirmOptions {
  title: string;
  body: string | Node;
  /** Label of the confirming button. Default "OK". */
  confirm?: string;
  cancel?: string;
  /** Styles the confirm button as destructive and focuses Cancel first. */
  danger?: boolean;
  /** The confirm button stays disabled until the player types one of these (case-insensitive). */
  typeToConfirm?: string[];
  /** Extra actions, such as "Export first". They sit left of the buttons and do not close the dialog. */
  extra?: HTMLElement;
}

/** True when the typed text is one of the accepted phrases, ignoring case and surrounding spaces. */
export const phraseMatches = (typed: string, phrases: string[]): boolean =>
  phrases.some((p) => typed.trim().toLowerCase() === p.trim().toLowerCase());

/**
 * Ask the player to confirm. Resolves true on confirm, false on Cancel, Escape or a click outside.
 * Focus is trapped inside the dialog and returns to whatever had it before.
 */
export function askConfirm(o: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const opener = document.activeElement as HTMLElement | null;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      document.removeEventListener('focusin', keepFocus, true);
      overlay.remove();
      opener?.focus?.({ preventScroll: true });
      resolve(ok);
    };
    const field = o.typeToConfirm?.length ? h('input', { class: 'confirm-type', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': `Type ${o.typeToConfirm.join(' or ')} to confirm`, placeholder: o.typeToConfirm.join(' or ') }) as HTMLInputElement : null;
    const ok = h('button', { class: `btn ${o.danger ? 'danger' : 'primary'}`, onclick: () => finish(true) }, o.confirm ?? 'OK') as HTMLButtonElement;
    const cancel = h('button', { class: 'btn ghost', onclick: () => finish(false) }, o.cancel ?? 'Cancel');
    const gate = () => { ok.disabled = !!field && !phraseMatches(field.value, o.typeToConfirm!); };
    field?.addEventListener('input', gate);
    gate();
    const dialog = h('div', { class: `confirm-dialog${o.danger ? ' danger' : ''}`, role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-title', 'aria-describedby': 'confirm-body' },
      h('header', { class: 'confirm-bar' }, h('span', { class: 'confirm-icon', 'aria-hidden': 'true' }, o.danger ? '!' : '?'), h('span', { id: 'confirm-title', class: 'confirm-title' }, o.title)),
      h('div', { id: 'confirm-body', class: 'confirm-body' }, typeof o.body === 'string' ? h('p', null, o.body) : o.body),
      field ? h('label', { class: 'confirm-field' }, h('span', { class: 'dim small' }, `Type ${o.typeToConfirm!.join(' or ')} to confirm.`), field) : null,
      h('footer', { class: 'confirm-actions' }, o.extra ?? null, h('span', { class: 'spacer' }), cancel, ok));
    const overlay = h('div', { class: 'confirm-bg', onclick: (e: Event) => { if (e.target === overlay) finish(false); } }, dialog);
    overlay.addEventListener('keydown', (e) => {
      e.stopPropagation(); // keys belong to the dialog, not to the windows behind it (Escape would close one)
      const t = e.target as HTMLElement;
      if (e.key === 'Escape') { e.preventDefault(); finish(false); return; }
      if (e.key === 'Enter' && (t === field || t === ok) && !ok.disabled) { e.preventDefault(); finish(true); return; }
      if (e.key === 'Tab') {
        const stops = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input')];
        const first = stops[0], last = stops[stops.length - 1];
        if (e.shiftKey && t === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && t === last) { e.preventDefault(); first.focus(); }
      }
    });
    // Anything that takes focus from outside (a window, the terminal) is pulled back in.
    const keepFocus = (e: FocusEvent) => { if (!overlay.contains(e.target as Node)) (field ?? ok).focus(); };
    document.addEventListener('focusin', keepFocus, true);
    document.body.append(overlay);
    (field ?? (o.danger ? cancel : ok)).focus();
  });
}
