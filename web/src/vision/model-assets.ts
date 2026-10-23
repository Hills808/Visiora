import { CONFIG } from '../config.js';
export interface ModelManifest {
  bytes: number;
  sha256: string;
  embeddings_sha256?: string;
  labels_sha256?: string;
  chunks: { path: string; bytes: number; sha256: string }[];
}
export async function sha256(data: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
}
export async function downloadModel(
  base: URL,
  manifest: ModelManifest,
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  if (
    !Number.isSafeInteger(manifest.bytes) ||
    manifest.bytes < 1 ||
    manifest.bytes > CONFIG.classification.maxModelBytes ||
    !manifest.chunks.length ||
    manifest.chunks.reduce((sum, part) => sum + part.bytes, 0) !== manifest.bytes
  )
    throw new Error('Manifesto do modelo inválido.');
  const result = new Uint8Array(manifest.bytes);
  let offset = 0;
  for (const part of manifest.chunks) {
    if (!/^[a-zA-Z0-9._-]+$/.test(part.path) || !Number.isSafeInteger(part.bytes) || part.bytes < 1)
      throw new Error('Parte do modelo inválida.');
    const response = await fetch(new URL(part.path, base), { signal });
    if (!response.ok) throw new Error('Não consegui baixar o modelo local. Tente novamente.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== part.bytes || (await sha256(bytes)) !== part.sha256)
      throw new Error('O download do modelo chegou incompleto ou alterado.');
    result.set(bytes, offset);
    offset += bytes.length;
    progress(offset, manifest.bytes);
  }
  if ((await sha256(result)) !== manifest.sha256)
    throw new Error('A integridade do modelo não foi confirmada.');
  return result;
}

export async function loadModelAsset(
  base: URL,
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; manifest: ModelManifest }> {
  const response = await fetch(new URL('manifest.json', base), { signal });
  if (!response.ok) throw new Error('O modelo local não está disponível para download.');
  const manifest = (await response.json()) as ModelManifest;
  const bytes = await downloadModel(base, manifest, signal, progress);
  return { bytes, manifest };
}

export async function verifiedData(
  base: URL,
  path: string,
  hash: string | undefined,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!hash || !/^[a-f0-9]{64}$/.test(hash))
    throw new Error('Manifesto sem verificação dos dados do modelo.');
  const response = await fetch(new URL(path, base), { signal });
  if (!response.ok) throw new Error('Não consegui carregar os dados do modelo.');
  const data = new Uint8Array(await response.arrayBuffer());
  if ((await sha256(data)) !== hash)
    throw new Error('Os dados do modelo chegaram incompletos ou alterados.');
  return data;
}
