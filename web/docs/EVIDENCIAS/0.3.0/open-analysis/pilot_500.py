"""Exploratory official SmolVLM ONNX generation; local CPU only."""
from __future__ import annotations
import json
import time
from pathlib import Path
import numpy as np
import onnxruntime as ort
from PIL import Image
from transformers import AutoConfig, AutoProcessor
from pilot import HERE, PROMPTS


def main():
    root = HERE / 'smolvlm-500m-onnx'
    config = AutoConfig.from_pretrained(str(root), local_files_only=True)
    processor = AutoProcessor.from_pretrained(str(root), local_files_only=True, size={'longest_edge': 512})
    eos_token_id = json.loads((root / 'generation_config.json').read_text('utf-8'))['eos_token_id']
    settings = ort.SessionOptions()
    settings.intra_op_num_threads = 3
    settings.inter_op_num_threads = 1
    start = time.perf_counter()
    vision, embed, decoder = [ort.InferenceSession(str(root / 'onnx' / f'{name}_quantized.onnx'), settings, providers=['CPUExecutionProvider']) for name in ['vision_encoder', 'embed_tokens', 'decoder_model_merged']]
    selection = json.loads((HERE / 'selection.json').read_text('utf-8'))
    report = {'model': 'HuggingFaceTB/SmolVLM-500M-Instruct', 'revision': 'a7da5b986cb59b408707209984f360a5f4ad7e47', 'license': 'Apache-2.0', 'quantization': 'official quantized ONNX, hashes in downloads-500m.json', 'runtime': {'ort': ort.__version__, 'device': 'CPU', 'threads': 3, 'longest_edge': 512, 'max_new_tokens': 96, 'concurrent_other_work': True}, 'load_ms': (time.perf_counter()-start)*1000, 'records': []}
    info = {name: [{'name': i.name, 'shape': i.shape, 'type': i.type} for i in sess.get_inputs()] for name, sess in [('vision',vision),('embed',embed),('decoder',decoder)]}
    (HERE / 'onnx-inputs-500m.json').write_text(json.dumps(info, indent=2), 'utf-8')
    for index, origin in enumerate(selection['images']):
        image = Image.open(HERE / 'images' / f'{index:02d}-{origin["expected"]}.jpg').convert('RGB')
        for language, question in PROMPTS.items():
            start = time.perf_counter()
            messages = [{'role': 'user', 'content': [{'type':'image'}, {'type':'text', 'text': question}]}]
            prompt = processor.apply_chat_template(messages, add_generation_prompt=True)
            inputs = processor(text=prompt, images=[image], return_tensors='np')
            input_ids = inputs['input_ids'].astype(np.int64)
            attention_mask = inputs['attention_mask'].astype(np.int64)
            position_ids = np.cumsum(attention_mask, axis=-1) - 1
            cfg = config.text_config
            cache = {f'past_key_values.{layer}.{kv}': np.zeros((1,cfg.num_key_value_heads,0,cfg.head_dim),dtype=np.float32) for layer in range(cfg.num_hidden_layers) for kv in ['key','value']}
            prepared = time.perf_counter()
            features = vision.run(['image_features'], {'pixel_values':inputs['pixel_values'].astype(np.float32),'pixel_attention_mask':inputs['pixel_attention_mask'].astype(np.bool_)})[0]
            tokens = []
            for step in range(96):
                embeddings = embed.run(None, {'input_ids':input_ids})[0]
                if step == 0:
                    embeddings[input_ids == config.image_token_id] = features.reshape(-1,features.shape[-1])
                logits, *present = decoder.run(None, {'inputs_embeds':embeddings,'attention_mask':attention_mask,'position_ids':position_ids,**cache})
                token = int(logits[0,-1].argmax())
                tokens.append(token)
                if token == eos_token_id:
                    break
                input_ids = np.array([[token]],dtype=np.int64)
                position_ids = position_ids[:,-1:] + 1
                attention_mask = np.concatenate([attention_mask,np.ones((1,1),dtype=np.int64)],axis=-1)
                for j, key in enumerate(cache):
                    cache[key] = present[j]
            text = processor.decode(tokens, skip_special_tokens=True)
            result = {'index':index, **origin, 'requested_language':language,'preprocess_ms':(prepared-start)*1000,'inference_ms':(time.perf_counter()-prepared)*1000,'tokens':len(tokens),'output':text}
            report['records'].append(result)
            (HERE / 'results-500m.json').write_text(json.dumps(report, indent=2,ensure_ascii=False),'utf-8')
            print(json.dumps(result,ensure_ascii=False),flush=True)
    print('PILOT COMPLETE',flush=True)


if __name__ == '__main__':
    main()
