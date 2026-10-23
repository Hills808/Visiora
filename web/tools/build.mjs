import { cp, mkdir, readdir, readFile, writeFile, rm, lstat, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
const root = await realpath('.');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist')
  throw new Error('Build target outside project');
try {
  if ((await lstat(output)).isSymbolicLink()) throw new Error('Build target must not be a symlink');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await rm(output, { recursive: true, force: true });
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc'], {
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await mkdir('dist/vendor', { recursive: true });
for (const name of [
  'ort.wasm.min.mjs',
  'ort.webgpu.min.mjs',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
])
  await cp(path.join('node_modules/onnxruntime-web/dist', name), path.join('dist/vendor', name));
const asyncifyWasm = await readFile(
  'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm',
);
const compressedWasm = gzipSync(asyncifyWasm, { level: 9 });
await writeFile('dist/vendor/ort-wasm-simd-threaded.asyncify.wasm.gz', compressedWasm);
await writeFile(
  'dist/vendor/asyncify-wasm.json',
  JSON.stringify({
    bytes: asyncifyWasm.length,
    sha256: createHash('sha256').update(asyncifyWasm).digest('hex'),
  }),
);
await cp('node_modules/fflate/esm/browser.js', 'dist/vendor/fflate.mjs');
await cp('node_modules/fflate/LICENSE', 'dist/licenses/fflate.txt');
await cp('node_modules/typescript/LICENSE', 'dist/licenses/TypeScript.txt');
const files = [];
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) await visit(name);
    else if (!name.endsWith('.map') && !name.endsWith('.zip') && entry.name !== 'sw.js')
      files.push('/' + path.relative('dist', name).replaceAll('\\', '/'));
  }
}
await visit('dist');
const extra = [
  { path: 'visiora/tools/serve.mjs', text: await readFile('tools/serve.mjs', 'utf8') },
  { path: 'visiora/LEIA-ME.txt', text: await readFile('LEIA-ME-LOCAL.txt', 'utf8') },
  {
    path: 'visiora/iniciar.cmd',
    text: '@echo off\r\ncd /d "%~dp0"\r\nnode tools/serve.mjs\r\npause\r\n',
  },
];
const packageFiles = [...files, '/sw.js', '/local-package.json']
  .sort()
  .map((url) => ({ url, path: 'visiora/dist' + url }));
await writeFile('dist/local-package.json', JSON.stringify({ version, files: packageFiles, extra }));
files.push('/local-package.json');
const sw = await readFile('public/sw.js', 'utf8');
const revision = createHash('sha256');
for (const url of files.sort()) {
  if (url.endsWith('.onnx') || url.endsWith('.wasm')) continue;
  revision.update(url);
  revision.update(await readFile(path.join('dist', url.slice(1))));
}
await writeFile(
  'dist/sw.js',
  sw
    .replace('__BUILD_ID__', revision.digest('hex').slice(0, 12))
    .replace('__PRECACHE__', JSON.stringify(files)),
);
const archive = spawnSync('python', ['tools/package_local.py'], { stdio: 'inherit' });
if (archive.status !== 0) process.exit(archive.status ?? 1);
console.log(JSON.stringify({ built: true, files: files.length }));
