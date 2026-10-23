import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const files = readdirSync('tests')
  .filter((name) => name.endsWith('.test.mjs'))
  .map((name) => `tests/${name}`);
for (const args of [
  ['tools/build.mjs'],
  ['--test', '--experimental-test-coverage', '--test-coverage-include=dist/brain/*.js', ...files],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
