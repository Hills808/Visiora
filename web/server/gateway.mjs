import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, POLICY } from './config.mjs';
import { Budget, GatewayError, failureCode } from './budget.mjs';
import { createProvider } from './provider.mjs';
import { validStamp, validEvidence } from '../dist/perception/evidence.js';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.zip': 'application/zip',
};
function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}
/** Read JPEG SOF dimensions without decoding pixels or trusting the multipart filename. */
export function jpegSize(bytes) {
  if (
    bytes.length < 4 ||
    bytes[0] !== 255 ||
    bytes[1] !== 216 ||
    bytes.at(-2) !== 255 ||
    bytes.at(-1) !== 217
  )
    throw new GatewayError(400, 'jpeg');
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 255) throw new GatewayError(400, 'jpeg-marker');
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) throw new GatewayError(400, 'jpeg-segment');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) throw new GatewayError(400, 'jpeg-sof');
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  throw new GatewayError(400, 'jpeg-dimensions');
}
async function body(req) {
  const size = Number(req.headers['content-length']);
  if (Number.isFinite(size) && size > POLICY.maxBodyBytes) throw new GatewayError(413, 'body');
  const chunks = [];
  let count = 0;
  for await (const chunk of req) {
    count += chunk.length;
    if (count > POLICY.maxBodyBytes) throw new GatewayError(413, 'body');
    chunks.push(chunk);
  }
  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('multipart/form-data;') || contentType.length > 200)
    throw new GatewayError(400, 'multipart');
  let form;
  try {
    form = await new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    throw new GatewayError(400, 'multipart');
  }
  if ([...form.keys()].length !== 2 || !form.has('metadata') || !form.has('image'))
    throw new GatewayError(400, 'fields');
  const raw = form.get('metadata'),
    image = form.get('image');
  if (
    typeof raw !== 'string' ||
    raw.length > 2000 ||
    !(image instanceof File) ||
    image.type !== 'image/jpeg' ||
    image.size > POLICY.maxImageBytes
  )
    throw new GatewayError(400, 'fields');
  let stamp;
  try {
    stamp = JSON.parse(raw);
  } catch {
    throw new GatewayError(400, 'metadata');
  }
  if (!validStamp(stamp)) throw new GatewayError(400, 'metadata');
  const bytes = Buffer.from(await image.arrayBuffer());
  const dims = jpegSize(bytes);
  if (
    dims.width !== stamp.width ||
    dims.height !== stamp.height ||
    Math.max(dims.width, dims.height) > POLICY.maxImageSide
  )
    throw new GatewayError(400, 'dimensions');
  return { stamp, bytes };
}
export function createGateway(
  config,
  {
    provider,
    budget = new Budget(config.ledger, config),
    fetcher = fetch,
    logModel = (event) => console.log(JSON.stringify(event)),
  } = {},
) {
  const analyze =
    provider ??
    createProvider(config, fetcher, (requestId, audit) => {
      budget.recordModel(requestId, audit);
      logModel({ event: 'visiora_model_response', requestId, ...audit });
    });
  const csrf = randomBytes(32).toString('hex');
  const server = http.createServer(
    { requestTimeout: 15000, headersTimeout: 10000 },
    async (req, res) => {
      let reserved = null;
      try {
        const host = req.headers.host;
        const port = server.address()?.port;
        if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`)
          throw new GatewayError(403, 'host');
        const origin = config.publicOrigin || `http://${host}`,
          url = new URL(req.url, origin);
        if (url.pathname.startsWith('/api/')) {
          if (req.headers.origin && req.headers.origin !== origin)
            throw new GatewayError(403, 'origin');
          if (req.headers['sec-fetch-site'] === 'cross-site') throw new GatewayError(403, 'origin');
          if (url.pathname === '/api/vision/status' && req.method === 'GET') {
            json(res, 200, {
              ready: config.ready,
              provider: config.provider,
              csrfToken: csrf,
              message: config.message,
            });
            return;
          }
          if (url.pathname !== '/api/vision/analyze' || req.method !== 'POST')
            throw new GatewayError(404, 'route');
          if (req.headers.origin !== origin || req.headers['x-visiora-csrf'] !== csrf)
            throw new GatewayError(403, 'csrf');
          if (!config.ready) throw new GatewayError(503, 'not-configured');
          if (
            config.provider === 'luna' &&
            req.headers['x-visiora-consent'] !== 'cloud-v3-continuity'
          )
            throw new GatewayError(403, 'consent');
          const { stamp, bytes } = await body(req);
          budget.reserve(
            stamp.requestId,
            config.provider === 'fake' ? 0 : POLICY.reservationMicros,
          );
          reserved = stamp.requestId;
          const result = await analyze(bytes, stamp);
          if (!validEvidence(result.evidence)) throw new GatewayError(422, 'invalid-evidence');
          if (config.provider === 'fake')
            budget.complete(reserved, { input_tokens: 0, output_tokens: 0 });
          else budget.complete(reserved, result.usage);
          reserved = null;
          json(res, 200, {
            schemaVersion: 1,
            source: config.provider,
            stamp,
            evidence: result.evidence,
          });
          return;
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') throw new GatewayError(405, 'method');
        const root = await realpath(config.root);
        const filename = path.resolve(
          root,
          '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
        );
        if (!filename.startsWith(root + path.sep)) throw new GatewayError(404, 'file');
        const actual = await realpath(filename);
        if (!actual.startsWith(root + path.sep) || !(await stat(actual)).isFile())
          throw new GatewayError(404, 'file');
        res.writeHead(200, {
          'Content-Type': types[path.extname(actual)] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        });
        if (req.method === 'HEAD') res.end();
        else
          createReadStream(actual)
            .on('error', () => res.destroy())
            .pipe(res);
      } catch (error) {
        const code = failureCode(error);
        if (reserved) {
          budget.uncertain(reserved, code);
          logModel({ event: 'visiora_analysis_failure', requestId: reserved, code });
        }
        const status =
          error instanceof GatewayError ? error.status : error.code === 'ENOENT' ? 404 : 500;
        // Never serialize upstream bodies, error messages, credentials, image or generated labels.
        if (!res.headersSent) json(res, status, { error: code });
        else res.destroy();
      }
    },
  );
  server.on('close', () => budget.close());
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const config = loadConfig();
  const server = createGateway(config);
  server.listen(config.port, '127.0.0.1', () =>
    console.log(`Visiora: http://127.0.0.1:${config.port} — ${config.message}`),
  );
}
