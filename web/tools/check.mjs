import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const errors = [];
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filename = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await visit(filename);
    else if (/\.(ts|mjs)$/.test(filename)) {
      const text = await readFile(filename, 'utf8');
      if (/\b(?:eval|new Function)\s*\(/.test(text)) errors.push(filename + ': dynamic execution');
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(text)) errors.push(filename + ': empty catch');
      if (filename.endsWith('.mjs')) {
        const result = spawnSync(process.execPath, ['--check', filename], { encoding: 'utf8' });
        if (result.status) errors.push(result.stderr);
      }
    }
  }
}
await visit('src');
await visit('tools');
await visit('tests');
await visit('server');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Syntax and project rules passed; TypeScript strict checks run separately.');
