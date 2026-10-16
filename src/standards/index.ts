import type { Rule } from './types';

export type { Rule };

// Every `rules-*.ts` file exports one or more arrays named `RULES_*`; they are collected here, so adding a plan item's
// lint rules means adding (or editing) a file, never touching a shared list.
const MODULES = import.meta.glob('./rules-*.ts', { eager: true }) as Record<string, Record<string, unknown>>;
export const RULES: Rule[] = Object.keys(MODULES).sort().flatMap((path) =>
  Object.entries(MODULES[path]).filter(([name]) => name.startsWith('RULES')).flatMap(([, v]) => v as Rule[]));
