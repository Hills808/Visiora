"""Exploratory, offline VLM pilot. No product code; no user image input."""
from __future__ import annotations

import hashlib
import io
import json
import time
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SCENE = ROOT / 'artifacts/scene'
CATEGORIES = ['living_room', 'bedroom', 'kitchen', 'bathroom', 'office', 'classroom', 'restaurant', 'corridor']
PROMPTS = {
    'pt-BR': 'Descreva esta imagem em português do Brasil, em até três frases curtas. Diga que tipo de ambiente aparece, quais objetos principais são visíveis e se há pessoas. Não invente detalhes. Se não conseguir identificar algo, diga que não sabe.',
    'en-control': 'Describe this image in up to three short sentences. State the type of place, the main visible objects, and whether any people are visible. Do not invent details. If uncertain, say you do not know.',
}


def select():
    records = json.loads((SCENE / 'confirmation.json').read_text('utf-8'))['records']
    selected = [next(r for r in records if r['split'] == 'test' and r['expected'] == category) for category in CATEGORIES]
    provenance = []
    images = []
    (HERE / 'images').mkdir(exist_ok=True)
    for i, record in enumerate(selected):
        with zipfile.ZipFile(SCENE / (record['source_archive'] + '.zip')) as z:
            data = z.read(record['source_file'])
        assert hashlib.sha256(data).hexdigest() == record['source_sha256']
        image = Image.open(io.BytesIO(data)).convert('RGB')
        image.save(HERE / 'images' / f'{i:02d}-{record["expected"]}.jpg')
        images.append(image)
        provenance.append({k: record[k] for k in ['expected', 'source_archive', 'source_file', 'source_sha256']})
    sheet = Image.new('RGB', (4 * 320, 2 * 270), 'white')
    draw = ImageDraw.Draw(sheet)
    for i, (image, record) in enumerate(zip(images, provenance)):
        thumb = image.copy()
        thumb.thumbnail((316, 242))
        x, y = i % 4 * 320, i // 4 * 270
        sheet.paste(thumb, (x, y + 23))
        draw.text((x + 4, y + 4), f'{i}: {record["expected"]}', fill='black')
    sheet.save(HERE / 'contact.png')
    manifest = {'selection_before_inference': 'First confirmation/test image in each of 8 categories, from existing deterministic hash-selected sample. Not selected for responses.', 'dataset': 'keremberke/indoor-scene-classification', 'dataset_revision': '030dcb9ec61c436299b1df10d90ae1cbe1d1b401', 'license_note': 'MIT IndoorScenes derived research images; not redistributed with app.', 'images': provenance, 'prompts': PROMPTS}
    (HERE / 'selection.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False), 'utf-8')
    return images, provenance


def main():
    images, provenance = select()
    import torch
    import transformers
    from transformers import AutoProcessor, AutoModelForVision2Seq

    torch.set_num_threads(3)
    torch.set_num_interop_threads(1)
    started = time.perf_counter()
    directory = str(HERE / 'smolvlm-256m')
    processor = AutoProcessor.from_pretrained(directory, local_files_only=True, size={'longest_edge': 512})
    model = AutoModelForVision2Seq.from_pretrained(directory, local_files_only=True, dtype=torch.float32, attn_implementation='eager').eval()
    report = {'model': 'HuggingFaceTB/SmolVLM-256M-Instruct', 'revision': '7e3e67edbbed1bf9888184d9df282b700a323964', 'license': 'Apache-2.0', 'weights_sha256': '74dea5904032e5ae99a2e0eef5179e6ac0f1dedc3ab0c7c2a5d4d387c843203e', 'runtime': {'torch': torch.__version__, 'transformers': transformers.__version__, 'device': 'CPU', 'dtype': 'float32', 'threads': 3, 'longest_edge': 512, 'do_sample': False, 'max_new_tokens': 96, 'concurrent_other_work': True}, 'load_ms': (time.perf_counter() - started)*1000, 'records': []}
    for index, (image, origin) in enumerate(zip(images, provenance)):
        for language, question in PROMPTS.items():
            messages = [{'role': 'user', 'content': [{'type': 'image'}, {'type': 'text', 'text': question}]}]
            start = time.perf_counter()
            prompt = processor.apply_chat_template(messages, add_generation_prompt=True)
            inputs = processor(text=prompt, images=[image], return_tensors='pt')
            prepared = time.perf_counter()
            with torch.inference_mode():
                generated = model.generate(**inputs, max_new_tokens=96, do_sample=False)
            text = processor.batch_decode(generated[:, inputs['input_ids'].shape[-1]:], skip_special_tokens=True)[0]
            record = {'index': index, **origin, 'requested_language': language, 'preprocess_ms': (prepared-start)*1000, 'inference_ms': (time.perf_counter()-prepared)*1000, 'tokens': generated.shape[-1]-inputs['input_ids'].shape[-1], 'output': text}
            report['records'].append(record)
            (HERE / 'results.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), 'utf-8')
            print(json.dumps(record, ensure_ascii=False), flush=True)
    print('PILOT COMPLETE', flush=True)


if __name__ == '__main__':
    main()
