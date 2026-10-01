// A small in-memory Unix filesystem for the Shell Lab: files and directories with modes and modification times.

export interface FileNode { type: 'file'; data: string; mode: number; mtime: number }
export interface DirNode { type: 'dir'; kids: Map<string, Node>; mode: number; mtime: number }
export type Node = FileNode | DirNode;

export class FsError extends Error {}

export const HOME = '/home/user';

export class Vfs {
  root: DirNode = { type: 'dir', kids: new Map(), mode: 0o755, mtime: 0 };
  /** Logical clock: every write bumps it, so `make` can compare modification times. */
  clock = 1;

  constructor(files: Record<string, string | { data: string; mode?: number }> = {}) {
    this.mkdir(HOME, true);
    for (const [p, v] of Object.entries(files)) {
      const abs = p.startsWith('/') ? p : `${HOME}/${p}`;
      const data = typeof v === 'string' ? v : v.data;
      this.mkdir(abs.slice(0, abs.lastIndexOf('/')) || '/', true);
      this.writeFile(abs, data);
      if (typeof v !== 'string' && v.mode !== undefined) this.chmod(abs, v.mode);
    }
  }

  tick() { return ++this.clock; }

  static normalize(path: string, cwd = HOME): string {
    const parts = (path.startsWith('/') ? path : `${cwd}/${path}`).split('/');
    const out: string[] = [];
    for (const p of parts) {
      if (p === '' || p === '.') continue;
      if (p === '..') out.pop(); else out.push(p);
    }
    return '/' + out.join('/');
  }

  get(path: string): Node | undefined {
    let n: Node = this.root;
    for (const p of path.split('/').filter(Boolean)) {
      if (n.type !== 'dir') return undefined;
      const k = n.kids.get(p);
      if (!k) return undefined;
      n = k;
    }
    return n;
  }

  private parent(path: string): { dir: DirNode; name: string } {
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) throw new FsError('is the root directory');
    const d = this.get('/' + parts.join('/'));
    if (!d) throw new FsError('No such file or directory');
    if (d.type !== 'dir') throw new FsError('Not a directory');
    return { dir: d, name };
  }

  exists(path: string) { return this.get(path) !== undefined; }
  isDir(path: string) { return this.get(path)?.type === 'dir'; }
  isFile(path: string) { return this.get(path)?.type === 'file'; }

  readFile(path: string): string {
    const n = this.get(path);
    if (!n) throw new FsError('No such file or directory');
    if (n.type === 'dir') throw new FsError('Is a directory');
    if (!(n.mode & 0o400)) throw new FsError('Permission denied');
    return n.data;
  }

  /** Create or overwrite (or append to) a file. */
  writeFile(path: string, data: string, append = false) {
    const { dir, name } = this.parent(path);
    const cur = dir.kids.get(name);
    if (cur?.type === 'dir') throw new FsError('Is a directory');
    if (cur && !(cur.mode & 0o200)) throw new FsError('Permission denied');
    const t = this.tick();
    if (cur) { cur.data = append ? cur.data + data : data; cur.mtime = t; }
    else dir.kids.set(name, { type: 'file', data, mode: 0o644, mtime: t });
    dir.mtime = t;
  }

  touch(path: string) {
    const n = this.get(path);
    if (n) n.mtime = this.tick(); else this.writeFile(path, '');
  }

  mkdir(path: string, parents = false) {
    const parts = path.split('/').filter(Boolean);
    let d: DirNode = this.root;
    parts.forEach((p, i) => {
      const k = d.kids.get(p);
      if (k) {
        if (k.type !== 'dir') throw new FsError('Not a directory');
        if (i === parts.length - 1 && !parents) throw new FsError('File exists');
        d = k;
      } else {
        if (i < parts.length - 1 && !parents) throw new FsError('No such file or directory');
        const nd: DirNode = { type: 'dir', kids: new Map(), mode: 0o755, mtime: this.tick() };
        d.kids.set(p, nd);
        d = nd;
      }
    });
  }

  remove(path: string, recursive = false) {
    const n = this.get(path);
    if (!n) throw new FsError('No such file or directory');
    if (n.type === 'dir' && !recursive) throw new FsError('Is a directory');
    const { dir, name } = this.parent(path);
    dir.kids.delete(name);
    dir.mtime = this.tick();
  }

  list(path: string): string[] {
    const n = this.get(path);
    if (!n || n.type !== 'dir') throw new FsError('Not a directory');
    return [...n.kids.keys()].sort();
  }

  chmod(path: string, mode: number) {
    const n = this.get(path);
    if (!n) throw new FsError('No such file or directory');
    n.mode = mode;
  }

  /** Move or rename a node. */
  move(from: string, to: string) {
    const n = this.get(from);
    if (!n) throw new FsError('No such file or directory');
    let dest = to;
    if (this.isDir(to)) dest = `${to}/${from.split('/').pop()}`;
    const { dir: sd, name: sn } = this.parent(from);
    const { dir: dd, name: dn } = this.parent(dest);
    sd.kids.delete(sn);
    dd.kids.set(dn, n);
    n.mtime = this.tick();
    sd.mtime = dd.mtime = n.mtime;
  }

  copy(from: string, to: string, recursive = false) {
    const n = this.get(from);
    if (!n) throw new FsError('No such file or directory');
    let dest = to;
    if (this.isDir(to)) dest = `${to}/${from.split('/').pop()}`;
    const clone = (x: Node): Node => (x.type === 'file'
      ? { type: 'file', data: x.data, mode: x.mode, mtime: this.tick() }
      : { type: 'dir', kids: new Map([...x.kids].map(([k, v]) => [k, clone(v)])), mode: x.mode, mtime: this.tick() });
    if (n.type === 'dir' && !recursive) throw new FsError('-r not specified; omitting directory');
    const { dir, name } = this.parent(dest);
    dir.kids.set(name, clone(n));
  }

  /** Every file path under a directory, depth first, sorted. */
  walk(path: string, includeDirs = false): string[] {
    const out: string[] = [];
    const rec = (p: string, n: Node) => {
      if (n.type === 'file') { out.push(p); return; }
      if (includeDirs) out.push(p);
      for (const k of [...n.kids.keys()].sort()) rec(`${p === '/' ? '' : p}/${k}`, n.kids.get(k)!);
    };
    const n = this.get(path);
    if (n) rec(path, n);
    return out;
  }

  /** Expand a glob pattern (* ? [..]) against the filesystem. Returns matches sorted; empty when none. */
  glob(pattern: string, cwd: string): string[] {
    const abs = pattern.startsWith('/');
    const parts = pattern.split('/').filter(Boolean);
    const results: string[] = [];
    const rx = (g: string) => new RegExp('^' + g.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '$');
    const join = (base: string, k: string) => `${base === '/' ? '' : base}/${k}`;
    const rec = (base: string, i: number, shown: string) => {
      if (i === parts.length) { results.push(shown); return; }
      const part = parts[i];
      const show = (k: string) => (shown ? `${shown === '/' ? '' : shown}/${k}` : k);
      if (!/[*?[]/.test(part)) {
        if (this.exists(join(base, part))) rec(join(base, part), i + 1, show(part));
        return;
      }
      const d = this.get(base);
      if (!d || d.type !== 'dir') return;
      const re = rx(part);
      for (const k of [...d.kids.keys()].sort()) {
        if (k.startsWith('.') && !part.startsWith('.')) continue;
        if (re.test(k)) rec(join(base, k), i + 1, show(k));
      }
    };
    rec(abs ? '/' : cwd, 0, abs ? '/' : '');
    return results.sort();
  }
}
