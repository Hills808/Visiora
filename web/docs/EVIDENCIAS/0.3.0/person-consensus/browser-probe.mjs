import { chromium } from '../../node_modules/playwright-core/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('artifacts/person-consensus');
const protocol=JSON.parse(await readFile(path.join(root,'protocol.json'),'utf8'));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:path.join(root,'downloads')});
try {
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://127.0.0.1:8080'||route.request().method()!=='GET')return route.abort();
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><title>Person consensus probe</title></html>'});
    let file;
    if(url.pathname.startsWith('/vendor/'))file=path.resolve('dist','.'+url.pathname);
    else if(url.pathname==='/pipeline.mjs')file=path.join(root,'pipeline-functions.mjs');
    else if(url.pathname==='/nano.onnx')file=path.resolve('public/models/yolox-nano.onnx');
    else if(url.pathname==='/tiny.onnx')file=path.resolve('artifacts/detector-upgrade/yolox_tiny.onnx');
    else if(url.pathname==='/s.onnx')file=path.resolve('artifacts/detector-upgrade/yolox_s.onnx');
    else if(url.pathname.startsWith('/image-')) {
      const index=Number(url.pathname.match(/^\/image-(\d+)\.jpg$/)?.[1]);
      if(!Number.isInteger(index)||index<0||index>2)return route.abort();
      file=path.join(root,'images',protocol.images[index].file_name);
    } else return route.abort();
    await route.fulfill({contentType:file.endsWith('.mjs')?'text/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream',body:await readFile(file)});
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8080');
  const result=await page.evaluate(async ({labels,imageIds})=>{
    const ort=await import('/vendor/ort.wasm.min.mjs');
    const pipeline=await import('/pipeline.mjs');
    ort.env.wasm.wasmPaths=new URL('/vendor/',location.href).href;
    ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';
    const sessions={},loadMs={},heads=[['nano',416],['tiny',416],['s',640]],images=[];
    for(const [head] of heads){const t=performance.now();sessions[head]=await ort.InferenceSession.create(`/${head}.onnx`,{executionProviders:['wasm'],graphOptimizationLevel:'all'});loadMs[head]=performance.now()-t;}
    for(let index=0;index<3;index++)images.push(await createImageBitmap(await(await fetch(`/image-${index}.jpg`)).blob()));
    function prepare(image,size) {
      const canvas=new OffscreenCanvas(size,size),ctx=canvas.getContext('2d');
      const ratio=Math.min(size/image.width,size/image.height);
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';
      ctx.fillStyle='rgb(114,114,114)';ctx.fillRect(0,0,size,size);
      const resizedWidth=Math.floor(image.width*ratio),resizedHeight=Math.floor(image.height*ratio);
      ctx.drawImage(image,0,0,resizedWidth,resizedHeight);
      const rgba=ctx.getImageData(0,0,size,size).data,area=size*size,data=new Float32Array(area*3);
      for(let pixel=0;pixel<area;pixel++)for(let channel=0;channel<3;channel++)data[channel*area+pixel]=rgba[pixel*4+2-channel];
      return {tensor:new ort.Tensor('float32',data,[1,3,size,size]),ratio,resizedWidth,resizedHeight};
    }
    const warmup=[];
    for(const [head,size] of heads){const prepared=prepare(images[0],size),begin=performance.now();const output=await sessions[head].run({[sessions[head].inputNames[0]]:prepared.tensor});warmup.push({head,inferenceMs:performance.now()-begin,finite:Object.values(output).every(tensor=>Array.from(tensor.data).every(Number.isFinite))});prepared.tensor.dispose();Object.values(output).forEach(tensor=>tensor.dispose());}
    const frames=[];
    for(let index=0;index<3;index++) {
      const image=images[index],start=performance.now(),byHead={},details=[];
      for(const [head,size] of heads) {
        const prepStart=performance.now(),prepared=prepare(image,size),prepMs=performance.now()-prepStart,inferStart=performance.now();
        const output=await sessions[head].run({[sessions[head].inputNames[0]]:prepared.tensor}),inferenceMs=performance.now()-inferStart;
        const decodeStart=performance.now(),first=output[sessions[head].outputNames[0]];
        byHead[head]=pipeline.decode(first.data,size,image.width,image.height,prepared.ratio,labels);
        details.push({head,size,resize:[prepared.resizedWidth,prepared.resizedHeight],preprocessMs:prepMs,inferenceMs,decodeMs:performance.now()-decodeStart,allMappedBeforeCap:byHead[head].length,outputShape:first.dims});
        prepared.tensor.dispose();Object.values(output).forEach(tensor=>tensor.dispose());
      }
      const compositionStart=performance.now(),composed=pipeline.compose(byHead),compositionMs=performance.now()-compositionStart,totalMs=performance.now()-start;
      frames.push({id:imageIds[index],source:[image.width,image.height],heads:details,compositionMs,fullFrameWarmMs:totalMs,wouldMeetBrain3000Ms:totalMs<=3000,baseline:composed.baseline,pipeline:composed.pipeline});
    }
    for(const [head]of heads)await sessions[head].release();images.forEach(image=>image.close());
    return {browser:navigator.userAgent,ortWeb:'1.30.0 bundled',provider:'wasm',threads:1,policy:'Fixed2of3 person only, Nano non-person unchanged score.50, globalNMS/cap30',transport:'Same-origin QA static fixture, SW blocked, JPEG decoded before measured frame',resize:'Product-style canvas low bilinear, floor-dimensions top-left letterbox114; rawBGR float32. This does not assert pixel identity with native OpenCV.',warmupPerHead:1,loadMs,warmup,frames,latencyGatePassed:frames.every(frame=>frame.wouldMeetBrain3000Ms),timingCaveat:'3warm fixture frames only, shared machine; no live camera, scenesmodel, speaker, transfer or endurance, not general latency guarantee'};
  },{labels:protocol.productClassMapping,imageIds:protocol.images.slice(0,3).map(image=>image.id)});
  result.pageErrors=errors;
  await writeFile(path.join(root,'browser-compatibility.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({latencyGatePassed:result.latencyGatePassed,frameMs:result.frames.map(frame=>frame.fullFrameWarmMs),headMs:result.frames.map(frame=>frame.heads.map(head=>({head:head.head,preprocessMs:head.preprocessMs,inferenceMs:head.inferenceMs,decodeMs:head.decodeMs}))),pageErrors:result.pageErrors}));
} catch(error) {
  await writeFile(path.join(root,'browser-compatibility.json'),JSON.stringify({error:error.message,stack:error.stack},null,2));
  throw error;
}finally{await browser.close();}
