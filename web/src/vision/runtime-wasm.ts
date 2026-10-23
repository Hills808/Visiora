import { sha256 } from './model-assets.js';

interface RuntimeManifest {
  bytes: number;
  sha256: string;
}

export async function loadRuntimeWasm(): Promise<Uint8Array<ArrayBuffer>> {
  const base = new URL('../vendor/', import.meta.url);
  const manifestResponse = await fetch(new URL('asyncify-wasm.json', base));
  if (!manifestResponse.ok) throw new Error('Manifesto do motor de visão indisponível.');
  const manifest = (await manifestResponse.json()) as RuntimeManifest;
  if (
    !Number.isSafeInteger(manifest.bytes) ||
    manifest.bytes < 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256)
  )
    throw new Error('Manifesto do motor de visão inválido.');
  const response = await fetch(new URL('ort-wasm-simd-threaded.asyncify.wasm.gz', base));
  if (!response.ok || !response.body) throw new Error('Motor de visão indisponível.');
  const bytes = new Uint8Array(
    await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),
  );
  if (bytes.length !== manifest.bytes || (await sha256(bytes)) !== manifest.sha256)
    throw new Error('A integridade do motor de visão não foi confirmada.');
  return bytes;
}
