"""Separate conservative policy with a genuinely new confirmation partition."""
from __future__ import annotations
import gc
import hashlib
import json
import time
import zipfile
from pathlib import Path
import numpy as np
import compare_precision as base

OUT=base.OUT
ROOT=base.ROOT
DATA=base.DATA
TARGETS={'livingroom':'living_room','bedroom':'bedroom','kitchen':'kitchen','bathroom':'bathroom','office':'office','classroom':'classroom','restaurant':'restaurant','corridor':'corridor'}

def main():
    development=json.loads((OUT/'development.json').read_text('utf-8'))
    choices=[]
    for model,report in development.items():
        grid=report.get('development_grid',[])
        eligible=[row for row in grid if row['accepted']>=10 and row['precision_when_accepted']>=.95 and row['wrong']<=1]
        if eligible:
            choice=max(eligible,key=lambda c:(c['correct'],c['precision_when_accepted'],c['margin'],c['minimum']))
            choices.append({'model':model,'bytes':report['bytes'],**choice})
    chosen=max(choices,key=lambda c:(c['correct'],c['precision_when_accepted'],-c['bytes'])) if choices else None
    frozen={'policy':'At least95% precision among at least10 accepted development inputs and at most1 wrong; maximize correct, precision, smaller file. Same frozen score/margin grid and unchanged88 text embeddings.','chosen':chosen,'choices':choices,'development_sha256':hashlib.sha256((OUT/'development.json').read_bytes()).hexdigest(),'at_unix':time.time(),'timing_correction':'Root requested conservative policy after first90% experiment had already evaluated indices12..16. Those40 cannot confirm this new policy. New indices17..21 are reserved here, before inference, for conservative confirmation. No tuning on private images or previous40.'}
    base.write('conservative-frozen-choice.json',frozen)
    print(json.dumps({'frozen_conservative_before_new_images':chosen}),flush=True)
    archives={name:zipfile.ZipFile(DATA/f'{name}.zip') for name in ['train','valid','test']}
    previous=json.loads((ROOT/'artifacts/recognition-upgrade/places-selection.json').read_text('utf-8'))
    previous_hashes={r['sha256'] for r in previous}
    selection=[]
    for source,expected in TARGETS.items():
        pool=[]
        for origin,archive in archives.items():
            for name in archive.namelist():
                if name.startswith(source+'/') and name.lower().endswith(('.jpg','.jpeg','.png')):
                    key=hashlib.sha256(Path(name).stem.split('.rf.')[0].encode()).hexdigest()
                    pool.append((key,origin,name))
        unique={}
        for key,origin,name in sorted(pool,key=lambda x:(x[0],x[2])):unique.setdefault(key,(origin,name))
        ordered=list(unique.values())
        assert len(ordered)>=22
        for index in range(17,22):
            origin,name=ordered[index]
            digest=hashlib.sha256(archives[origin].read(name)).hexdigest()
            assert digest not in previous_hashes
            selection.append({'split':'conservative_confirmation','index':index,'expected':expected,'source_archive':origin,'source_file':name,'sha256':digest})
    assert len(selection)==40 and len({r['sha256'] for r in selection})==40
    base.write('conservative-selection.json',selection)
    candidates=json.loads((ROOT/'public/models/siglip2/embeddings.json').read_text('utf-8'))['candidates']
    embeddings=np.array([r['vector'] for r in candidates],dtype=np.float32)
    reports={}
    for model in list(dict.fromkeys(['q4']+([chosen['model']] if chosen else []))):
        engine,load_ms=base.session(model)
        rows=base.infer(engine,selection,archives,candidates,embeddings)
        minimum,margin=(chosen['minimum'],chosen['margin']) if chosen and model==chosen['model'] else (.12,.03)
        times=[r['inference_ms'] for r in rows]
        reports[model]={'thresholds':{'minimum':minimum,'margin':margin},'strict':base.summarize(rows,minimum,margin),'coarse':base.summarize(rows,minimum,margin,True),'records':rows,'latency_ms':{'p50':float(np.percentile(times,50)),'p95':float(np.percentile(times,95))},'load_ms':load_ms}
        print(json.dumps({'new_confirmation_model':model,'strict':reports[model]['strict'],'coarse':reports[model]['coarse']}),flush=True)
        base.write('conservative-confirmation.json',reports)
        del engine
        gc.collect()
    for archive in archives.values():archive.close()
    base.write('conservative-comparison.json',{'frozen_choice':frozen,'selection_sha256':hashlib.sha256((OUT/'conservative-selection.json').read_bytes()).hexdigest(),'confirmation':reports,'limits':'40 public images/8classes; annotations uncertain and unknown pretraining overlap. No private-photo tuning, Brazilian scenes or users. No safety or broad-accuracy claim.'})

if __name__=='__main__':main()
