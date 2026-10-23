// Compatibility probe only. Public COCO input; no product modifications.
import { chromium } from '../../node_modules/playwright-core/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('artifacts/detector-upgrade');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, downloadsPath: path.join(root,'downloads') });
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:8080' || route.request().method() !== 'GET') return route.abort();
    if (url.pathname === '/') return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><title>Probe</title></html>'});
    let file;
    if (url.pathname.startsWith('/vendor/')) file = path.resolve('dist', '.'+url.pathname);
    else if (url.pathname === '/nano.onnx') file = path.resolve('public/models/yolox-nano.onnx');
    else if (url.pathname === '/tiny.onnx') file = path.join(root,'yolox_tiny.onnx');
    else if (url.pathname === '/s.onnx') file = path.join(root,'yolox_s.onnx');
    else if (url.pathname === '/input.jpg') file = path.join(root,'images','000000415741.jpg');
    else return route.abort();
    await route.fulfill({contentType:file.endsWith('.mjs')?'text/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream',body:await readFile(file)});
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8080');
  const result = await page.evaluate(async () => {
    const ort = await import('/vendor/ort.wasm.min.mjs');
    ort.env.wasm.wasmPaths = new URL('/vendor/', location.href).href;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.logLevel = 'error';
    const img = await createImageBitmap(await (await fetch('/input.jpg')).blob());
    const results=[];
    for(const [name,size] of [['nano',416],['tiny',416],['s',640]]) {
      const started=performance.now();
      const session=await ort.InferenceSession.create(`/${name}.onnx`,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
      const loadMs=performance.now()-started;
      const canvas=new OffscreenCanvas(size,size),ctx=canvas.getContext('2d');
      ctx.fillStyle='rgb(114,114,114)';ctx.fillRect(0,0,size,size);
      const ratio=Math.min(size/img.width,size/img.height);
      ctx.drawImage(img,0,0,Math.floor(img.width*ratio),Math.floor(img.height*ratio));
      const rgba=ctx.getImageData(0,0,size,size).data,area=size*size,input=new Float32Array(area*3);
      for(let p=0;p<area;p++)for(let c=0;c<3;c++)input[c*area+p]=rgba[p*4+2-c];
      const tensor=new ort.Tensor('float32',input,[1,3,size,size]);
      const begin=performance.now();
      const output=await session.run({[session.inputNames[0]]:tensor});
      const inferMs=performance.now()-begin,first=output[session.outputNames[0]];
      results.push({name,loadMsExploratory:loadMs,inferenceMsExploratory:inferMs,input:[1,3,size,size],output:first.dims,finite:Array.from(first.data).every(Number.isFinite)});
      tensor.dispose();Object.values(output).forEach(t=>t.dispose());await session.release();
    }
    img.close();
    return {browser:navigator.userAgent,runtime:'onnxruntime-web bundled 1.30.0',provider:'wasm',threads:1,transport:'same-origin static fixture; SW blocked',input:'COCO val2017 image415741 public photo',timingCaveat:'one cold inference per model, CPU shared; exploratory only, not controlled performance benchmark',results};
  });
  await writeFile(path.join(root,'browser-compatibility.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
