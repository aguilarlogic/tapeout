// The TAPE-OS theme: "tapeout" (the dark terminal look, the default) or "light" (the look before U16). Stored in the
// prefs and applied as data-theme on <html>; the colours live in os.css under [data-theme].
export type Theme = 'tapeout' | 'light';

/** Anything that is not "light" is TAPE-OS, so a damaged or older save still gets the default look. */
export const normaliseTheme = (v: unknown): Theme => (v === 'light' ? 'light' : 'tapeout');
