// Shared helpers for the specialty-lab missions (generic lab page).
export const near = (a: unknown, b: number, tol = 0.51) => String(a).trim() !== '' && Number.isFinite(Number(a)) && Math.abs(Number(a) - b) <= tol;
export const r1 = (x: number) => Math.round(x * 10) / 10;
export const r2 = (x: number) => Math.round(x * 100) / 100;
export const r3 = (x: number) => Math.round(x * 1000) / 1000;
export const db10 = (x: number) => 10 * Math.log10(Math.max(x, 1e-30));
export const db20 = (x: number) => 20 * Math.log10(Math.max(x, 1e-30));

export type Cx = { re: number; im: number };
export const cx = (re: number, im = 0): Cx => ({ re, im });
export const cadd = (a: Cx, b: Cx): Cx => cx(a.re + b.re, a.im + b.im);
export const cmul = (a: Cx, b: Cx): Cx => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const cdiv = (a: Cx, b: Cx): Cx => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
export const cabs = (a: Cx) => Math.hypot(a.re, a.im);
export const cpar = (a: Cx, b: Cx) => cdiv(cmul(a, b), cadd(a, b));
