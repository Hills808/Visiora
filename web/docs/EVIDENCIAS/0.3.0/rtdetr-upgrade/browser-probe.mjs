// Compatibility only: public COCO photo, frozen selected variant, no product edit.
import { chromium } from '../../node_modules/playwright-core/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('artifacts/rtdetr-upgrade');
const selection = JSON.parse(await readFile(path.join(root, 'selection.json'), 'utf8'));
if (!selection.selected) {
  await writeFile(path.join(root, 'browser-compatibility.json'), JSON.stringify({ skipped: true, reason: 'No development-eligible variant; confirmation not used to rescue selection' }, null, 2));
  process.exit(0);
}
const variant = selection.selected.variant;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, downloadsPath: path.join(root, 'downloads') });
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:8080' || route.request().method() !== 'GET') return route.abort();
    if (url.pathname === '/') return route.fulfill({contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><title>RT-DETRv2 probe</title></html>'});
    let file;
    if (url.pathname.startsWith('/vendor/')) file = path.resolve('dist', '.' + url.pathname);
    else if (url.pathname === '/model.onnx') file = path.join(root, variant === 'f32' ? 'model.onnx' : 'model_uint8.onnx');
    else if (url.pathname === '/input.jpg') file = path.resolve('artifacts/detector-upgrade/images/000000415741.jpg');
    else return route.abort();
    await route.fulfill({contentType: file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream', body: await readFile(file)});
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8080');
  const result = await page.evaluate(async ({variant, thresholds}) => {
    const ort = await import('/vendor/ort.wasm.min.mjs');
    ort.env.wasm.wasmPaths = new URL('/vendor/', location.href).href;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.logLevel = 'error';
    const started = performance.now();
    const session = await ort.InferenceSession.create('/model.onnx', {executionProviders: ['wasm'], graphOptimizationLevel: 'all'});
    const loadMs = performance.now() - started;
    const image = await createImageBitmap(await (await fetch('/input.jpg')).blob());
    const canvas = new OffscreenCanvas(640, 640), ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, 640, 640);
    const rgba = ctx.getImageData(0, 0, 640, 640).data, area = 640*640, input = new Float32Array(area*3);
    for (let p = 0; p < area; p++) for (let c = 0; c < 3; c++) input[c*area+p] = rgba[p*4+c]/255;
    const tensor = new ort.Tensor('float32', input, [1, 3, 640, 640]);
    const begin = performance.now();
    const outputs = await session.run({pixel_values: tensor});
    const elapsed = performance.now()-begin;
    const dims = Object.fromEntries(Object.entries(outputs).map(([name, tensor]) => [name, tensor.dims]));
    const finite = Object.values(outputs).every(tensor => Array.from(tensor.data).every(Number.isFinite));
    const logits = outputs.logits.data, boxes = outputs.pred_boxes.data;
    const flat = Array.from(logits, (logit, index) => ({index, score: 1/(1+Math.exp(-logit))})).sort((a,b) => b.score-a.score || a.index-b.index).slice(0,300);
    const seen = new Set(), mapped = new Set([0,1,2,3,5,6,7,13,14,15,16,24,25,26,28,39,41,42,43,44,45,46,47,49,52,56,57,58,59,60,61,62,63,64,65,66,67,68,69,71,72,73,74,75,76,77,78,79]);
    const targets = {0:'person',56:'chair',59:'bed'}, kept=[];
    let repeatedSameQueryAboveMinScore = 0;
    for (const {index,score} of flat) {
      const query=Math.floor(index/80), cls=index%80;
      if(seen.has(query)){repeatedSameQueryAboveMinScore += Number(score >= .45);continue;}
      seen.add(query);
      if(score < .45 || !mapped.has(cls)) continue;
      const [cx,cy,bw,bh] = boxes.slice(query*4,query*4+4);
      const box=[Math.max(0,(cx-bw/2)*image.width),Math.max(0,(cy-bh/2)*image.height),Math.min(image.width,(cx+bw/2)*image.width),Math.min(image.height,(cy+bh/2)*image.height)];
      if(box[2]<=box[0] || box[3]<=box[1]) continue;
      kept.push({classId:cls,queryIndex:query,score,box});
    }
    const detections = kept.slice(0,30).filter(det => targets[det.classId] && det.score >= thresholds[targets[det.classId]]).map(det=>({...det,class:targets[det.classId]}));
    tensor.dispose();Object.values(outputs).forEach(t=>t.dispose());await session.release();image.close();
    return {browser:navigator.userAgent,runtime:'onnxruntime-web bundled1.30.0',provider:'wasm',threads:1,transport:'Same-origin static fixture; service workers blocked',input:'COCO val2017 public image415741, RGB canvas high resize640 rescale1/255',timingCaveat:'One cold inference, shared CPU; not controlled latency or equivalence to native PIL preprocessing',variant,inputShape:[1,3,640,640],outputs:dims,finite,loadMsExploratory:loadMs,inferenceMsExploratory:elapsed,repeatedSameQueryAboveMinScore,detections};
  }, {variant, thresholds:selection.selected.thresholds});
  result.pageErrors = errors;
  await writeFile(path.join(root,'browser-compatibility.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} catch(error) {
  await writeFile(path.join(root,'browser-compatibility.json'),JSON.stringify({variant,error:error.message,stack:error.stack},null,2));
  throw error;
} finally { await browser.close(); }
