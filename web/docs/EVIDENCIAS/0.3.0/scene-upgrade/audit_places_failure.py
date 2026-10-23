"""Preserve rejected Places365 development outputs without lowering policy."""
from __future__ import annotations
import hashlib
import io
import json
import time
import zipfile
from pathlib import Path
import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/scene-upgrade'
DATA=ROOT/'artifacts/scene'
GROUPS={'bedroom':['bedroom','bedchamber','childs_room','dorm_room','hotel_room','nursery'],'classroom':['classroom','kindergarden_classroom','lecture_room'],'office':['office','home_office','office_cubicles'],'kitchen':['kitchen','restaurant_kitchen','galley'],'restaurant':['restaurant','restaurant_patio','fastfood_restaurant']}
ALIASES={name:category for category,names in GROUPS.items() for name in names}
SCORES=[.2,.25,.3,.35,.4,.45,.5,.55,.6,.65,.7,.75,.8]
MARGINS=[.05,.1,.15,.2,.25,.3]

def summarize(records,score,margin,coarse=True):
    accepted=[r for r in records if r['score']>=score and r['margin']>=margin]
    correct=sum((r['category'] if coarse else r['raw_category'])==r['expected'] for r in accepted)
    return {'score':score,'margin':margin,'samples':len(records),'raw_top1_correct':sum((r['category'] if coarse else r['raw_category'])==r['expected'] for r in records),'accepted':len(accepted),'correct':correct,'wrong':len(accepted)-correct,'abstained':len(records)-len(accepted),'precision_when_accepted':correct/len(accepted) if accepted else None,'coverage':len(accepted)/max(1,len(records))}

def main():
    selection=json.loads((ROOT/'artifacts/recognition-upgrade/places-selection.json').read_text('utf-8'))
    dev=[r for r in selection if r['split']=='development']
    assert len(dev)==96
    names=[line.split()[0][3:] for line in (DATA/'categories_places365.txt').read_text().splitlines()]
    categories=[ALIASES.get(name,name.replace('/','_').replace('-','_')) for name in names]
    options=ort.SessionOptions();options.intra_op_num_threads=4
    engine=ort.InferenceSession(str(DATA/'places365.onnx'),options,providers=['CPUExecutionProvider'])
    archives={name:zipfile.ZipFile(DATA/f'{name}.zip') for name in ['train','valid','test']}
    records=[]
    for sample in dev:
        encoded=archives[sample['source_archive']].read(sample['source_file'])
        assert hashlib.sha256(encoded).hexdigest()==sample['sha256']
        image=Image.open(io.BytesIO(encoded)).convert('RGB')
        pixels=np.asarray(image.resize((256,256),Image.Resampling.BILINEAR).crop((16,16,240,240)),dtype=np.float32)/255
        tensor=((pixels-np.array([.485,.456,.406],dtype=np.float32))/np.array([.229,.224,.225],dtype=np.float32)).transpose(2,0,1)[None].copy()
        started=time.perf_counter();logits=engine.run(None,{'pixel_values':tensor})[0][0];elapsed=(time.perf_counter()-started)*1000
        scores=np.exp(logits-logits.max());scores/=scores.sum()
        ranked=np.argsort(scores)[::-1];top=int(ranked[0]);runner=next(int(i) for i in ranked if categories[int(i)]!=categories[top])
        records.append({**sample,'category':categories[top],'raw_category':names[top],'score':float(scores[top]),'margin':float(scores[top]-scores[runner]),'runner':categories[runner],'inference_ms':elapsed,'top5':[{'category':names[int(i)],'score':float(scores[int(i)])} for i in ranked[:5]]})
    grid=[summarize(records,score,margin) for score in SCORES for margin in MARGINS]
    enough=[r for r in grid if r['accepted']>=10]
    eligible=[r for r in enough if r['precision_when_accepted']>=.90]
    best_precision=max(enough,key=lambda r:(r['precision_when_accepted'],r['correct'],r['margin'],r['score'])) if enough else None
    best_correct=max(enough,key=lambda r:(r['correct'],r['precision_when_accepted'],r['margin'],r['score'])) if enough else None
    report={'model':'Places365 ResNet18','runtime':ort.__version__,'threads':4,'preprocessing':'Same as previous failed comparison: warp RGB to256x256, PIL bilinear, crop center224, ImageNet normalization','groups':GROUPS,'adoption_policy':'>=90% precision among >=10 accepted development samples; unchanged','eligible_policy_count':len(eligible),'adoption_passed':bool(eligible),'best_precision_with_at_least10':best_precision,'maximum_correct_with_at_least10':best_correct,'grid':grid,'records':records,'scope':'Development only. 40 new confirmation samples deliberately not run in this audit. Source annotations and unknown pretraining overlap limit conclusions.'}
    (OUT/'places-failure-audit.json').write_text(json.dumps(report,indent=2)+'\n','utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ['records','grid','groups']},indent=2))
    for archive in archives.values():archive.close()

if __name__=='__main__':main()
