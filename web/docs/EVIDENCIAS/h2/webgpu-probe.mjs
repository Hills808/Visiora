import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'https://example.com' || route.request().method() !== 'GET')
      return route.abort();
    if (url.pathname === '/')
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>H2 probe</title>' });
    const files = {
      '/ort.webgpu.min.mjs': 'node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs',
      '/ort.wasm.min.mjs': 'node_modules/onnxruntime-web/dist/ort.wasm.min.mjs',
      '/ort-wasm-simd-threaded.jsep.mjs': 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs',
      '/ort-wasm-simd-threaded.jsep.wasm': 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm',
      '/ort-wasm-simd-threaded.asyncify.mjs': 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs',
      '/ort-wasm-simd-threaded.asyncify.wasm': 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm',
      '/ort-wasm-simd-threaded.mjs': 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
      '/ort-wasm-simd-threaded.wasm': 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
      '/nano.onnx': 'public/models/yolox-nano.onnx',
      '/tiny.onnx': 'artifacts/detector-upgrade/yolox_tiny.onnx',
      '/s.onnx': 'artifacts/detector-upgrade/yolox_s.onnx',
      '/input.jpg': 'artifacts/vision/dog.jpg',
    };
    const file = files[url.pathname];
    if (!file) return route.abort();
    const contentType = file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
    return route.fulfill({ contentType, body: await readFile(path.resolve(file)) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('https://example.com/');
  const result = await page.evaluate(async () => {
    const results = [];
    const img = await createImageBitmap(await (await fetch('/input.jpg')).blob());
    const inputs = {};
    for (const size of [416, 640]) {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgb(114,114,114)';
      ctx.fillRect(0, 0, size, size);
      const ratio = Math.min(size / img.width, size / img.height);
      ctx.drawImage(img, 0, 0, Math.floor(img.width * ratio), Math.floor(img.height * ratio));
      const rgba = ctx.getImageData(0, 0, size, size).data;
      const area = size * size;
      const input = new Float32Array(area * 3);
      for (let p = 0; p < area; p++)
        for (let c = 0; c < 3; c++) input[c * area + p] = rgba[p * 4 + 2 - c];
      inputs[size] = input;
    }
    const saved = {};
    for (const [model, size] of [['nano', 416], ['tiny', 416], ['s', 640]]) for (const provider of ['wasm', 'webgpu', 'webgpu-bundle-wasm']) {
      try {
        const ort = await import(provider === 'wasm' ? '/ort.wasm.min.mjs' : '/ort.webgpu.min.mjs');
        ort.env.wasm.wasmPaths = new URL('/', location.href).href;
        ort.env.wasm.numThreads = 1;
        ort.env.logLevel = 'error';
        const t0 = performance.now();
        const session = await ort.InferenceSession.create(`/${model}.onnx`, {
          executionProviders: [provider === 'webgpu-bundle-wasm' ? 'wasm' : provider],
          graphOptimizationLevel: 'all',
        });
        const loadMs = performance.now() - t0;
        const tensor = new ort.Tensor('float32', inputs[size], [1, 3, size, size]);
        const timings = [];
        let outputSize;
        let maxAbsDifference;
        for (let i = 0; i < 7; i++) {
          const t1 = performance.now();
          const output = await session.run({ [session.inputNames[0]]: tensor });
          timings.push(performance.now() - t1);
          const value = output[session.outputNames[0]];
          if (i === 6) {
            outputSize = value.data.length;
            if (provider === 'wasm') saved[model] = Float32Array.from(value.data);
            else {
              const reference = saved[model];
              if (reference.length !== value.data.length) throw new Error('Output length differs');
              maxAbsDifference = 0;
              for (let j = 0; j < reference.length; j++)
                maxAbsDifference = Math.max(maxAbsDifference, Math.abs(reference[j] - value.data[j]));
            }
          }
          Object.values(output).forEach((item) => item.dispose());
        }
        tensor.dispose();
        await session.release();
        results.push({ model, provider, loadMs, timings, outputSize, maxAbsDifference });
      } catch (error) {
        results.push({ model, provider, error: String(error) });
      }
    }
    img.close();
    const workerResult = await new Promise((resolve) => {
      const source = `self.onmessage = async () => {
        try {
          const ort = await import(self.location.origin + '/ort.webgpu.min.mjs');
          ort.env.wasm.wasmPaths = new URL('/', self.location.origin).href;
          ort.env.wasm.numThreads = 1;
          const session = await ort.InferenceSession.create(self.location.origin + '/nano.onnx', {executionProviders:['webgpu'], graphOptimizationLevel:'all'});
          const input = new ort.Tensor('float32', new Float32Array(416*416*3).fill(114), [1,3,416,416]);
          const start = performance.now();
          const output = await session.run({[session.inputNames[0]]:input});
          self.postMessage({ok:true, webgpu:!!navigator.gpu, inferMs:performance.now()-start, count:output[session.outputNames[0]].data.length});
          input.dispose(); Object.values(output).forEach(x=>x.dispose()); await session.release();
        } catch(error) {self.postMessage({ok:false,error:String(error)});}
      };`;
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      const worker = new Worker(url);
      worker.onmessage = (event) => { worker.terminate(); URL.revokeObjectURL(url); resolve(event.data); };
      worker.onerror = (event) => { worker.terminate(); URL.revokeObjectURL(url); resolve({ok:false,error:event.message}); };
      worker.postMessage(null);
    });
    return { secure: isSecureContext, gpuAvailable: !!(await navigator.gpu?.requestAdapter()), workerResult, results };
  });
  console.log(JSON.stringify({ ...result, errors }));
} finally {
  await browser.close();
}
