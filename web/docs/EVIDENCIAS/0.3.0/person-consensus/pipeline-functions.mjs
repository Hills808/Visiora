// Artifact-only executable browser probe, matching the frozen Python policy.
export function iou(a,b) {
  const intersection=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
  const union=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-intersection;
  return union>0?intersection/union:0;
}
export function cap(input,limit=30) {
  const kept=[];
  for(const candidate of [...input].sort((a,b)=>b.score-a.score)) {
    if(kept.some(prior=>prior.class===candidate.class&&iou(prior.box,candidate.box)>.45))continue;
    kept.push(candidate);
    if(kept.length===limit)break;
  }
  return kept;
}
export function decode(data,size,width,height,ratio,labels) {
  const candidates=[];
  let row=0;
  for(const stride of [8,16,32])for(let gy=0;gy<size/stride;gy++)for(let gx=0;gx<size/stride;gx++,row++) {
    const offset=row*85,objectness=data[offset+4];
    if(objectness<.45)continue;
    let cls=0,probability=0;
    for(let c=0;c<80;c++)if(data[offset+5+c]>probability){probability=data[offset+5+c];cls=c;}
    const score=objectness*probability;
    if(score<.45||!labels[cls]||!Number.isFinite(score))continue;
    const cx=(data[offset]+gx)*stride,cy=(data[offset+1]+gy)*stride,bw=Math.exp(data[offset+2])*stride,bh=Math.exp(data[offset+3])*stride;
    const box=[Math.max(0,Math.min(width,(cx-bw/2)/ratio)),Math.max(0,Math.min(height,(cy-bh/2)/ratio)),Math.max(0,Math.min(width,(cx+bw/2)/ratio)),Math.max(0,Math.min(height,(cy+bh/2)/ratio))];
    if(!box.every(Number.isFinite)||box[2]<=box[0]||box[3]<=box[1])continue;
    candidates.push({class:labels[cls],classId:cls,score,box,anchorIndex:row});
  }
  return cap(candidates,Number.POSITIVE_INFINITY);
}
export function personConsensus(byHead) {
  const candidates=[];
  for(const head of ['nano','tiny','s'])byHead[head].filter(det=>det.class==='person'&&det.score>=.45).forEach((det,sourceIndex)=>candidates.push({...det,head,sourceIndex}));
  candidates.sort((a,b)=>b.score-a.score||(a.head<b.head?-1:a.head>b.head?1:0)||a.sourceIndex-b.sourceIndex);
  const assigned=new Set(),clusters=[];
  for(let seedIndex=0;seedIndex<candidates.length;seedIndex++) {
    if(assigned.has(seedIndex))continue;
    const seed=candidates[seedIndex],members=[seed],indices=[seedIndex],heads=new Set([seed.head]);
    for(let index=0;index<candidates.length;index++) {
      const candidate=candidates[index];
      if(index===seedIndex||assigned.has(index)||heads.has(candidate.head))continue;
      if(members.every(member=>iou(candidate.box,member.box)>=.5)){members.push(candidate);indices.push(index);heads.add(candidate.head);}
    }
    if(heads.size<2)continue;
    indices.forEach(index=>assigned.add(index));
    clusters.push({class:'person',box:[0,1,2,3].map(coordinate=>members.reduce((sum,det)=>sum+det.box[coordinate],0)/members.length),score:members.reduce((sum,det)=>sum+det.score,0)/members.length,votes:members.length});
  }
  return cap(clusters).filter(det=>det.score>=.5);
}
export function compose(byHead) {
  const baseline=cap(byHead.nano.filter(det=>det.score>=.5));
  const persons=personConsensus(byHead);
  const pipeline=cap([...byHead.nano.filter(det=>det.class!=='person'&&det.score>=.5),...persons]);
  return {baseline,pipeline,personConsensusCount:persons.length};
}
