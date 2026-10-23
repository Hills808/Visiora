import { cp, lstat, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const host = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const repository = path.resolve(host, '../..');
const source = path.join(repository, 'web');
const target = path.join(host, 'web');
if (target !== path.join(repository, 'hosting', 'luna', 'web'))
  throw new Error('Unexpected staging directory');
try {
  const existing = await lstat(target);
  if (existing.isSymbolicLink()) throw new Error('Staging directory is a symlink');
  await rm(target, { recursive: true });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
const ignored = new Set(['node_modules', 'dist', 'artifacts', '.runtime', '.git', '.openai']);
const modelRoot = path.join(source, 'public', 'models');
await cp(source, target, { recursive: true, filter: (entry) => {
  const full = path.resolve(entry);
  if (full === modelRoot || full.startsWith(modelRoot + path.sep)) return false;
  if (full === source) return true;
  const relative = path.relative(source, full);
  return !relative.split(path.sep).some((part) => ignored.has(part) || part === '.env' || part.startsWith('.env.'));
} });
await cp(path.join(host, 'hosted-index.html'), path.join(target, 'public', 'index.html'));
console.log('Visiora web staged for Luna-only build.');
