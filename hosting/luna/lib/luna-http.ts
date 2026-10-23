import { Buffer } from 'node:buffer';
import { validStamp, type CaptureStamp } from '../web/src/perception/evidence';
import { LunaError } from './luna-budget';
import { POLICY } from './luna-policy';

export function json(status: number, data: unknown): Response {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}

export function errorResponse(error: unknown): Response {
  const known = error instanceof LunaError;
  return json(known ? error.status : 500, { error: known ? error.code : 'internal' });
}

export function requireIdentity(request: Request): string {
  const user = request.headers.get('oai-authenticated-user-id');
  if (!user) throw new LunaError(403, 'auth');
  return user;
}

export function requireSameOrigin(request: Request): void {
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site')
    throw new LunaError(403, 'origin');
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 ||
    bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) throw new LunaError(400, 'jpeg');
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 255) throw new LunaError(400, 'jpeg-marker');
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) throw new LunaError(400, 'jpeg-segment');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) throw new LunaError(400, 'jpeg-sof');
      return { height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6] };
    }
    offset += length;
  }
  throw new LunaError(400, 'jpeg-dimensions');
}

export async function readImage(request: Request): Promise<{ stamp: CaptureStamp; bytes: Uint8Array }> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.startsWith('multipart/form-data;') || type.length > 200) throw new LunaError(400, 'multipart');
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > POLICY.maxBodyBytes) throw new LunaError(413, 'body');
  if (!request.body) throw new LunaError(400, 'body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > POLICY.maxBodyBytes) {
      await reader.cancel();
      throw new LunaError(413, 'body');
    }
    chunks.push(value);
  }
  let form: FormData;
  try {
    form = await new Request('https://visiora.invalid/', { method: 'POST',
      headers: { 'Content-Type': type }, body: Buffer.concat(chunks) }).formData();
  } catch {
    throw new LunaError(400, 'multipart');
  }
  if ([...form.keys()].length !== 2 || !form.has('metadata') || !form.has('image'))
    throw new LunaError(400, 'fields');
  const raw = form.get('metadata');
  const image = form.get('image');
  if (typeof raw !== 'string' || raw.length > 2_000 || !(image instanceof File) ||
    image.type !== 'image/jpeg' || image.size > POLICY.maxImageBytes) throw new LunaError(400, 'fields');
  let stamp: unknown;
  try { stamp = JSON.parse(raw); } catch { throw new LunaError(400, 'metadata'); }
  if (!validStamp(stamp)) throw new LunaError(400, 'metadata');
  const bytes = new Uint8Array(await image.arrayBuffer());
  const dims = jpegSize(bytes);
  if (dims.width !== stamp.width || dims.height !== stamp.height ||
    Math.max(dims.width, dims.height) > POLICY.maxImageSide) throw new LunaError(400, 'dimensions');
  return { stamp, bytes };
}
