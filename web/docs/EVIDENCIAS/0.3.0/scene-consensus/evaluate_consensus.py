"""Frozen two-model scene consensus research; no product or private-image changes."""
from __future__ import annotations

import gc
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
OUT=ROOT/'artifacts/scene-consensus'
DATA=ROOT/'artifacts/scene'
SIG_PATH=DATA/'siglip/onnx/vision_model_q4.onnx'
PLACES_PATH=DATA/'places365.onnx'
EMBEDDING_PATH=ROOT/'public/models/siglip2/embeddings.json'
TARGETS={'livingroom':'living_room','bedroom':'bedroom','kitchen':'kitchen','bathroom':'bathroom','office':'office','classroom':'classroom','restaurant':'restaurant','corridor':'corridor'}
# Exact predeclared taxonomy families. No image/object-to-place hints.
GROUPS={'bedroom':['bedroom','bedchamber','childs_room','dorm_room','hotel_room','nursery'],'classroom':['classroom','kindergarden_classroom','lecture_room'],'office':['office','home_office','office_cubicles'],'kitchen':['kitchen','restaurant_kitchen','galley'],'restaurant':['restaurant','restaurant_patio','fastfood_restaurant']}
ALIASES={name:category for category,names in GROUPS.items() for name in names}
PROBABILITIES=[.3,.4,.5,.6,.7,.8]
MARGINS=[.1,.15,.2,.25,.3]


def canonical(name,*,sig=False):
    if sig:name={'children_room':'childs_room','kindergarten':'kindergarden_classroom'}.get(name,name)
    return ALIASES.get(name,name.replace('/','_').replace('-','_'))


def write(name,data):
    (OUT/name).write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def evaluate(samples,archives,sig,places,candidates,vectors,names,families):
    records=[]
    for sample in samples:
        encoded=archives[sample['source_archive']].read(sample['source_file'])
        assert hashlib.sha256(encoded).hexdigest()==sample['sha256']
        image=Image.open(io.BytesIO(encoded)).convert('RGB')
        pixels=np.asarray(image.resize((224,224),Image.Resampling.BILINEAR),dtype=np.float32)
        sig_input=((pixels/127.5-1).transpose(2,0,1)[None]).copy()
        start=time.perf_counter()
        feature=sig.run(['pooler_output'],{'pixel_values':sig_input})[0][0]
        sig_ms=(time.perf_counter()-start)*1000
        assert np.isfinite(feature).all()
        feature/=np.linalg.norm(feature)
        similarities=vectors@feature
        sr=np.argsort(similarities)[::-1]
        top_sig=int(sr[0])
        sig_top5=[{'id':candidates[int(i)]['id'],'family':canonical(candidates[int(i)]['id'],sig=True),'reject':candidates[int(i)]['reject'],'cosine':float(similarities[int(i)])} for i in sr[:5]]
        places_input=((pixels/255-np.array([.485,.456,.406],dtype=np.float32))/np.array([.229,.224,.225],dtype=np.float32)).transpose(2,0,1)[None].copy()
        start=time.perf_counter()
        logits=places.run(None,{'pixel_values':places_input})[0][0]
        places_ms=(time.perf_counter()-start)*1000
        probs=np.exp(logits-logits.max());probs/=probs.sum()
        assert np.isfinite(probs).all()
        pr=np.argsort(probs)[::-1]
        top_places=int(pr[0])
        runner=next(int(i) for i in pr if families[int(i)]!=families[top_places])
        match=next((r for r in sig_top5[:3] if not r['reject'] and r['family']==families[top_places]),None)
        compatible=bool(not candidates[top_sig]['reject'] and match and match['cosine']>=.12 and sig_top5[0]['cosine']-match['cosine']<=.015)
        records.append({**sample,'places_raw':names[top_places],'places_family':families[top_places],'places_probability':float(probs[top_places]),'places_margin_between_families':float(probs[top_places]-probs[runner]),'places_runner_raw':names[runner],'places_runner_family':families[runner],'sig_top1_raw':candidates[top_sig]['id'],'sig_top1_family':canonical(candidates[top_sig]['id'],sig=True),'sig_top1_reject':candidates[top_sig]['reject'],'sig_score':float(similarities[top_sig]),'sig_margin':float(similarities[top_sig]-similarities[int(sr[1])]),'sig_top5':sig_top5,'matched_sig':match,'compatible_before_places_thresholds':compatible,'sig_ms':sig_ms,'places_ms':places_ms,'places_top5':[{'id':names[int(i)],'family':families[int(i)],'probability':float(probs[int(i)])} for i in pr[:5]]})
    return records


def accepted(row,probability,margin):
    return row['compatible_before_places_thresholds'] and row['places_probability']>=probability and row['places_margin_between_families']>=margin


def summary(rows,probability=None,margin=None,*,baseline=False):
    if baseline:
        subset=[r for r in rows if not r['sig_top1_reject'] and r['sig_score']>=.12 and r['sig_margin']>=.03]
    else:
        subset=[r for r in rows if accepted(r,probability,margin)]
    family_key='sig_top1_family' if baseline else 'places_family'
    raw_key='sig_top1_raw' if baseline else 'places_raw'
    correct=sum(r[family_key]==r['expected'] for r in subset)
    return {'samples':len(rows),'accepted':len(subset),'correct_family':correct,'wrong_family':len(subset)-correct,'abstained':len(rows)-len(subset),'precision_when_accepted':correct/len(subset) if subset else None,'coverage':len(subset)/max(1,len(rows)),'accepted_strict_raw_correct':sum(r[raw_key]==r['expected'] for r in subset),'raw_top1_family_correct':sum(r[family_key]==r['expected'] for r in rows)}


def confirmation_selection(archives):
    previous=[]
    for path in [ROOT/'artifacts/recognition-upgrade/places-selection.json',ROOT/'artifacts/scene-upgrade/conservative-selection.json']:
        previous.extend(json.loads(path.read_text('utf-8')))
    previous_hashes={r['sha256'] for r in previous}
    selected=[]
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
        assert len(ordered)>=27
        for index in range(22,27):
            origin,name=ordered[index]
            digest=hashlib.sha256(archives[origin].read(name)).hexdigest()
            assert digest not in previous_hashes
            selected.append({'split':'consensus_confirmation','index':index,'expected':expected,'source_archive':origin,'source_file':name,'sha256':digest})
    assert len(selected)==40 and len({r['sha256'] for r in selected})==40
    return selected


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    candidates=json.loads(EMBEDDING_PATH.read_text('utf-8'))['candidates']
    vectors=np.array([r['vector'] for r in candidates],dtype=np.float32)
    names=[line.split()[0][3:] for line in (DATA/'categories_places365.txt').read_text('utf-8').splitlines()]
    families=[canonical(name) for name in names]
    prior_source=json.loads((ROOT/'artifacts/recognition-upgrade/places-selection.json').read_text('utf-8'))
    development=[r for r in prior_source if r['split']=='development']
    assert len(development)==96
    models={
        'siglip':{'file':str(SIG_PATH.relative_to(ROOT)),'bytes':SIG_PATH.stat().st_size,'sha256':sha(SIG_PATH),'repository':'onnx-community/siglip2-base-patch16-224-ONNX','revision':'ba1f3b0843f24bc5417d38e19c37b287d719b2f4','original_repository':'google/siglip2-base-patch16-224','original_revision':'75de2d55ec2d0b4efc50b3e9ad70dba96a7b2fa2','original_license':'Apache-2.0','conversion_card':'Links original model; no separate license field'},
        'places':{'file':str(PLACES_PATH.relative_to(ROOT)),'bytes':PLACES_PATH.stat().st_size,'sha256':sha(PLACES_PATH),'architecture':'ResNet18 Places365','source':'CSAILVision/places365, resnet18_places365.pth.tar, public author checkpoint','checkpoint_sha256':sha(DATA/'resnet18_places365.pth.tar'),'checkpoint_bytes':(DATA/'resnet18_places365.pth.tar').stat().st_size,'weight_license':'CC BY, version unspecified by authors','code_license':'MIT','onnx_conversion':'Existing local float32 opset17 export; no new conversion or weights'},
    }
    protocol={
        'purpose':'Learned whole-image scene consensus, finite catalogs, not open-ended visual analysis. No object hints, private images or category forcing.',
        'families':GROUPS,'canonicalization':'Only predeclared aliases plus replacing slash and hyphen with underscore. Sig children_room -> childs_room and kindergarten -> kindergarden_classroom before aliases. Other incompatible names remain incompatible.',
        'sig_gate':{'top_raw_candidates':3,'minimum_cosine':.12,'maximum_distance_from_top1':.015,'reject_top1_aborts':True,'reject_candidates_never_match':True},
        'places_gate':'Use raw top1 class probability, not summed family probability. Margin is raw top1 probability minus strongest raw class in another family.',
        'output':'Canonical Places top1 family, supported by a compatible Sig candidate. Any canonical category can pass; evaluation targets do not restrict gating.',
        'probability_grid':PROBABILITIES,'family_margin_grid':MARGINS,
        'adoption_policy':'At least95% family precision, at most1 wrong family, at least10 accepted dev. Maximize correct accepted, then precision, then stricter margin and probability. Freeze before any new test inference. If no dev candidate passes, stop without opening indices22..26.',
        'preprocessing':'Both models receive the same whole RGB frame warped directly to224x224, PIL bilinear, no crop. Sig normalizes x/127.5-1; Places uses x/255 and ImageNet mean [.485,.456,.406]/std [.229,.224,.225]. This differs from previous Places center-crop audit and is frozen before dev.',
        'development':'Same96 public original-photo-hash samples indices0..11; includes earlier research samples, no claim of independent dev.',
        'confirmation_if_eligible':'40 next hash-ordered photos, indices22..26 per8classes, no SHA overlap with all prior0..21. Not opened unless dev candidate passes.',
        'baseline':'q4 Sig alone, cosine>=.12 and raw top1 margin>=.03, reject top1 abstains. Apply same canonicalization only for scoring.',
        'models':models,'embedding_sha256':sha(EMBEDDING_PATH),'categories_places_sha256':sha(DATA/'categories_places365.txt'),
        'runtime':ort.__version__,'provider':'CPUExecutionProvider','threads':4,'frozen_at_unix':time.time(),
        'limits':'Small MIT-derived public8class dataset with uncertain annotations and unknown pretraining overlap; not Brazilian, users, safety or accessibility validation.',
    }
    write('protocol.json',protocol)
    write('development-selection.json',development)
    options=ort.SessionOptions();options.intra_op_num_threads=4
    sig=ort.InferenceSession(str(SIG_PATH),options,providers=['CPUExecutionProvider'])
    places=ort.InferenceSession(str(PLACES_PATH),options,providers=['CPUExecutionProvider'])
    archives={name:zipfile.ZipFile(DATA/f'{name}.zip') for name in ['train','valid','test']}
    dev=evaluate(development,archives,sig,places,candidates,vectors,names,families)
    grid=[{'places_probability':probability,'places_family_margin':margin,**summary(dev,probability,margin)} for probability in PROBABILITIES for margin in MARGINS]
    eligible=[r for r in grid if r['accepted']>=10 and r['precision_when_accepted']>=.95 and r['wrong_family']<=1]
    chosen=max(eligible,key=lambda r:(r['correct_family'],r['precision_when_accepted'],r['places_family_margin'],r['places_probability'])) if eligible else None
    development_report={'baseline':summary(dev,baseline=True),'records':dev,'grid':grid,'eligible_count':len(eligible),'chosen':chosen,'compatible_before_places_thresholds':sum(r['compatible_before_places_thresholds'] for r in dev),'latency_ms_exploratory':{'sig_p50':float(np.percentile([r['sig_ms'] for r in dev],50)),'places_p50':float(np.percentile([r['places_ms'] for r in dev],50)),'sum_p50':float(np.percentile([r['sig_ms']+r['places_ms'] for r in dev],50))}}
    write('development.json',development_report)
    frozen={'protocol_sha256':sha(OUT/'protocol.json'),'development_sha256':sha(OUT/'development.json'),'chosen':chosen,'at_unix':time.time(),'confirmation_evaluated':False,'confirmation_selection_opened':False}
    write('frozen-choice.json',frozen)
    print(json.dumps({'dev_baseline':development_report['baseline'],'chosen':chosen,'eligible':len(eligible),'compatible_before_thresholds':development_report['compatible_before_places_thresholds']}),flush=True)
    if chosen:
        selection=confirmation_selection(archives)
        write('confirmation-selection.json',selection)
        test=evaluate(selection,archives,sig,places,candidates,vectors,names,families)
        final={'consensus':summary(test,chosen['places_probability'],chosen['places_family_margin']),'baseline':summary(test,baseline=True),'chosen':chosen,'output_model':'Canonical Places raw-top1 family, approved by compatible SigLIP q4 top3 candidate','records':test,'limits':protocol['limits'],'no_recalibration':True,'latency_ms_exploratory':{'sig_p50':float(np.percentile([r['sig_ms'] for r in test],50)),'places_p50':float(np.percentile([r['places_ms'] for r in test],50)),'sum_p50':float(np.percentile([r['sig_ms']+r['places_ms'] for r in test],50))}}
        write('confirmation.json',final)
        print(json.dumps({k:v for k,v in final.items() if k not in ['records']}),flush=True)
    else:
        enough=[r for r in grid if r['accepted']>=10]
        best=max(enough,key=lambda r:(r['precision_when_accepted'],r['correct_family'],r['places_family_margin'],r['places_probability'])) if enough else None
        write('rejected.json',{'reason':'No dev pair met frozen95%/max1wrong/min10accepted policy','best_precision_at_least10':best,'confirmation_indices22_to26_not_opened':True})
        print(json.dumps({'stopped_without_confirmation':True,'best_precision_at_least10':best}),flush=True)
    for archive in archives.values():archive.close()
    del sig,places;gc.collect()


if __name__=='__main__':main()
