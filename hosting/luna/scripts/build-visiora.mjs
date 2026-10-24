import { spawnSync } from 'node:child_process';
import { cpSync, copyFileSync, existsSync, lstatSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const web = path.join(root, 'web');
const result = spawnSync(process.execPath, ['tools/build.mjs'], {
  cwd: web,
  env: { ...process.env, VISIORA_HOSTED_LUNA_ONLY: '1' },
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const staleModels = path.join(root, 'public', 'models');
if (path.dirname(path.resolve(staleModels)) !== path.join(root, 'public'))
  throw new Error('Unexpected generated models path');
if (existsSync(staleModels)) {
  if (lstatSync(staleModels).isSymbolicLink()) throw new Error('Generated models path is a symlink');
  rmSync(staleModels, { recursive: true, force: true });
}
cpSync(path.join(web, 'dist'), path.join(root, 'public'), { recursive: true, force: true });
copyFileSync(path.join(web, 'dist', 'index.html'), path.join(root, 'public', 'visiora.html'));
