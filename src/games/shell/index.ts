// The Shell Lab machine: a virtual filesystem, bash, coreutils, make, a pretend compiler and git.
import { UTILS } from './cmds';
import { git } from './git';
import { cc, make, runExe } from './make';
import { Shell } from './sh';
import { Vfs } from './vfs';

export function createShell(files: Record<string, string | { data: string; mode?: number }> = {}, cwd?: string): Shell {
  const sh = new Shell(new Vfs(files), { ...UTILS, make, cc, gcc: cc, git });
  sh.exeRunner = runExe;
  if (cwd) sh.cwd = Vfs.normalize(cwd, sh.cwd);
  return sh;
}
export { Shell, Vfs };
