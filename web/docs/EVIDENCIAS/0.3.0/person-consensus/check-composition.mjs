import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compose } from './pipeline-functions.mjs';

const root=path.resolve('artifacts/person-consensus');
const native=JSON.parse(await readFile(path.join(root,'results.json'),'utf8'));
let maxAbsDifference=0, checked=0;
const failures=[];
for(const row of native.rows) {
  const actual=compose(row.allMappedBeforeCap);
  for(const [expectedKey,actualKey] of [['nanoBaseline','baseline'],['pipeline','pipeline']]) {
    const expected=row[expectedKey],observed=actual[actualKey];
    if(expected.length!==observed.length){failures.push({id:row.id,channel:expectedKey,error:'length',expected:expected.length,observed:observed.length});continue;}
    for(let index=0;index<expected.length;index++) {
      const a=expected[index],b=observed[index];
      if(a.class!==b.class){failures.push({id:row.id,channel:expectedKey,index,error:'class'});continue;}
      const differences=[Math.abs(a.score-b.score),...a.box.map((value,c)=>Math.abs(value-b.box[c]))];
      maxAbsDifference=Math.max(maxAbsDifference,...differences);
      if(differences.some(value=>value>1e-9))failures.push({id:row.id,channel:expectedKey,index,error:'numeric',differences});
      checked++;
    }
  }
}
const result={publicImages:native.rows.length,channelsPerImage:2,detectionsChecked:checked,tolerance:1e-9,maxAbsDifference,passed:failures.length===0,failures,scope:'Artifact browser composition implementation vs Python using same full-mapped detections; not equivalence of JPEG/canvas/OpenCV or ONNX runtimes'};
await writeFile(path.join(root,'composition-parity.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
if(!result.passed)process.exitCode=1;
