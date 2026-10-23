// Local compatibility/RAM snapshots only. Same-origin fixtures, no real server.
import { chromium } from '../../node_modules/playwright-core/index.mjs';
import { open, readFile, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const root=path.resolve('artifacts/scene-upgrade');
const model=process.argv[2]||'fp16';
const files={q4:path.resolve('artifacts/scene/siglip/onnx/vision_model_q4.onnx'),fp16:path.join(root,'vision_model_fp16.onnx'),f32:path.join(root,'vision_model.onnx')};
if(!files[model])throw Error('Unknown probe model');
const modelBytes=(await stat(files[model])).size,chunkBytes=10000000;
const runFile=promisify(execFile);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:path.join(root,'downloads')});
try {
  const browserCDP=await browser.newBrowserCDPSession();
  async function memorySnapshot(label){
    const {processInfo}=await browserCDP.send('SystemInfo.getProcessInfo');
    const ids=processInfo.map(x=>Number(x.id)).filter(x=>Number.isSafeInteger(x)&&x>0);
    const command=`$sceneProcessIds=@(${ids.join(',')}); @(Get-Process -Id $sceneProcessIds -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PeakWorkingSet64,PrivateMemorySize64) | ConvertTo-Json -Compress`;
    const {stdout}=await runFile('powershell',['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{cwd:process.cwd(),windowsHide:true,maxBuffer:100000});
    const parsed=JSON.parse(stdout),rows=Array.isArray(parsed)?parsed:[parsed];
    return {label,processes:rows.length,workingSetSumBytes:rows.reduce((s,r)=>s+r.WorkingSet64,0),privateMemorySumBytes:rows.reduce((s,r)=>s+r.PrivateMemorySize64,0),rows};
  }
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://127.0.0.1:8080'||route.request().method()!=='GET')return route.abort();
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><title>SigLIP2 probe</title></html>'});
    const match=/^\/chunk\/(\d+)\.bin$/.exec(url.pathname);
    if(match){
      const index=Number(match[1]),offset=index*chunkBytes;
      if(offset>=modelBytes)return route.abort();
      const bytes=Buffer.alloc(Math.min(chunkBytes,modelBytes-offset));
      const handle=await open(files[model],'r');
      try{const result=await handle.read(bytes,0,bytes.length,offset);if(result.bytesRead!==bytes.length)throw Error('Truncated chunk');}finally{await handle.close();}
      return route.fulfill({contentType:'application/octet-stream',body:bytes});
    }
    let file;
    if(url.pathname.startsWith('/vendor/'))file=path.resolve('dist','.'+url.pathname);
    else if(url.pathname==='/input.bin')file=path.join(root,'browser-input.f32');
    else if(url.pathname==='/embeddings.json')file=path.resolve('public/models/siglip2/embeddings.json');
    else return route.abort();
    await route.fulfill({contentType:file.endsWith('.mjs')?'text/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.json')?'application/json':'application/octet-stream',body:await readFile(file)});
  });
  const page=await context.newPage();
  await page.exposeFunction('snapshotMemory',memorySnapshot);
  await page.goto('http://127.0.0.1:8080');
  let result;
  try {
    result=await page.evaluate(async ({model,modelBytes,chunkBytes})=>{
      const ort=await import('/vendor/ort.wasm.min.mjs');
      ort.env.wasm.wasmPaths=new URL('/vendor/',location.href).href;
      ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';
      const memory=[await window.snapshotMemory('before-model')];
      let modelData=new Uint8Array(modelBytes);
      for(let offset=0,index=0;offset<modelBytes;offset+=chunkBytes,index++)modelData.set(new Uint8Array(await (await fetch(`/chunk/${index}.bin`)).arrayBuffer()),offset);
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',modelData)),x=>x.toString(16).padStart(2,'0')).join('');
      memory.push(await window.snapshotMemory('downloaded-model-bytes'));
      const started=performance.now();
      const session=await ort.InferenceSession.create(modelData,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
      const loadMs=performance.now()-started;
      modelData=null;
      memory.push(await window.snapshotMemory('session-loaded'));
      const input=new Float32Array(await (await fetch('/input.bin')).arrayBuffer());
      const tensor=new ort.Tensor('float32',input,[1,3,224,224]);
      const vectors=(await (await fetch('/embeddings.json')).json()).candidates;
      const runs=[];
      for(let index=0;index<3;index++){
        const then=performance.now();
        const output=await session.run({pixel_values:tensor},['pooler_output']);
        const elapsed=performance.now()-then;
        const feature=output.pooler_output.data;
        if(!Array.from(feature).every(Number.isFinite))throw Error('Nonfinite output');
        const norm=Math.hypot(...feature);
        const rank=vectors.map(v=>({category:v.id,score:v.vector.reduce((s,x,i)=>s+x*feature[i]/norm,0)})).sort((a,b)=>b.score-a.score);
        runs.push({index,inferenceMsExploratory:elapsed,outputDimensions:output.pooler_output.dims,finite:true,top5:rank.slice(0,5),margin:rank[0].score-rank[1].score});
        Object.values(output).forEach(t=>t.dispose());
        memory.push(await window.snapshotMemory(`after-inference-${index}`));
      }
      tensor.dispose();await session.release();
      memory.push(await window.snapshotMemory('session-released'));
      return {model,modelBytes,sha256:hash,loadMsExploratory:loadMs,runs,memory,browser:navigator.userAgent,runtime:'onnxruntime-web1.30.0',provider:'wasm',threads:1};
    },{model,modelBytes,chunkBytes});
  }catch(error){result={model,modelBytes,error:String(error)};}
  result.transport='Same-origin static Playwright route fixtures; no server, SW blocked, no external calls';
  result.memoryCaveat='Snapshots of own Chrome process working sets/private memory, not guaranteed peak; sums can double-count shared memory. Not phone memory, endurance or concurrent detector/voice test.';
  result.timingCaveat='3 single-thread cold/warm inferences, shared CPU, exploratory compatibility only. Excludes camera, voice, download. No accuracy claims.';
  result.input='First frozen public development photo, exact PIL224 RGB normalized float32 input; no private image.';
  await writeFile(path.join(root,`browser-${model}.json`),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}finally{await browser.close();}
