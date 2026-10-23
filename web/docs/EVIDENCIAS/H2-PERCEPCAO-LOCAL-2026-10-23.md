# H2 parcial — execução local e candidatos de detector (23/10/2026)

**IDs:** CA-D1/CA-H4 (latência local), CA-P3/CA-H3 (qualidade de referências), CA-H7 (retorno à CPU), CA-E1 (pacote/testes). H2 ainda não está aprovado para fala híbrida no modo Luna.

## Mudança que entrou no aplicativo

O worker de objetos continua com os mesmos pesos YOLOX Nano/Tiny/S e a mesma regra de consenso para pessoas. Tenta ONNX Runtime Web 1.30.0 com WebGPU; se a inicialização/aquecimento falhar, libera as sessões e inicia os três modelos em WASM. O status e o diagnóstico mostram GPU ou CPU. O ZIP e o cache offline incluem o runtime WebGPU. O worker de ambiente SigLIP2/Places365 continua em WASM; o modo Luna continua sem detector local real.

No PC Intel i7-10700F, RTX 3060 12 GB, Windows, Node 24.11.0 e Chrome instalado, `node tests/e2e/people.mjs --fixtures` executou os três modelos reais sobre vídeo artificial de uma foto pública COCO 23899. Em duas execuções, a inferência completa de objetos no worker foi de **64–124 ms em 13 quadros WebGPU**; com `--disable-gpu`, **1334–1665 ms em seis quadros WASM**. Na segunda execução, `navigator.gpu` foi forçado a retornar um adaptador ausente, exercitando a falha de inicialização e o retorno à CPU. Ambos produziram as mesmas referências textuais para esta foto, com normalização de espaços. A tentativa anterior em WASM no mesmo fluxo foi ~1,3–1,4 s. Este ensaio não mede captura→voz, desempenho sustentado, consumo de RAM, energia, nem equivalência em outras fotos. O E2E de lugares passou com objetos WebGPU, mas a análise de ambiente seguiu **1568–1651 ms em cinco amostras**. O gargalo de lugar permanece.

Um teste separado com a foto pública `dog.jpg` do YOLOX comparou saídas numéricas dos três pesos nos dois backends: diferenças absolutas máximas ~7,7e-5 (Nano), 2,75e-5 (Tiny) e 7,25e-5 (S). É uma verificação de uma entrada, não equivalência estatística de reconhecimento. O retorno à CPU foi exercitado desativando a GPU antes de iniciar, não simulando perda de dispositivo em sessão.

## Pesquisa de qualidade antes de trocar o detector

Protocolos, seleção congelada, contagens por foto e cópia do script estão em [h2/](h2/). O script original depende dos pesos, fotos públicas e ambiente Python ignorados em `artifacts/`; os JSONs preservam o resultado mesmo sem esses binários. Foram usadas 60 fotos públicas COCO val2017 para desenvolvimento e 30 fotos distintas para confirmação. A confirmação já havia sido examinada na pesquisa YOLOX anterior; portanto **não é teste cego independente para a equipe**. Há possível sobreposição com pré-treino dos modelos. Correspondência por classe usa IoU ≥0,5; os JSON registram limites e limiares. Não há foto privada do usuário nos conjuntos ou no repositório.

| Modelo/peso | Tamanho | Desenvolvimento: pessoa / cadeira / cama (TP/FP/FN) | Confirmação: pessoa / cadeira / cama (TP/FP/FN) | Decisão |
| --- | ---: | --- | --- | --- |
| RF-DETR Nano ONNX uint8 | 28,8 MB | 66/3/36 · 39/4/38 · 9/0/4 | 37/1/17 · **9/6/13** · 3/1/4 | Rejeitado: seis referências de cadeira sem anotação correspondente e uma de cama. |
| D-FINE Nano ONNX uint8 | 4,8 MB | 68/7/34 · nenhum limiar de cadeira elegível · 8/0/5 | Não executada após falha de desenvolvimento | Rejeitado. |
| D-FINE Nano ONNX F32 | 15,4 MB | 64/4/38 · 20/2/57 · 8/0/5 | 35/2/19 · **9/7/13** · 3/0/4 | Rejeitado: sete referências de cadeira sem anotação correspondente. |
| YOLOX atual, mesmas 30 fotos de confirmação | pesos já distribuídos | política anterior | 27/3/27 · **7/2/15** · 3/0/4 | Mantido no produto. |

TP = objeto anotado detectado; FP = detecção sem correspondência na anotação; FN = objeto anotado omitido. RF-DETR e D-FINE detectaram mais pessoas e cadeiras que o baseline nesta amostra, mas aumentaram falsos de cadeira. Em pelo menos uma foto negativa (COCO 78915, estádio de tênis), há assentos visíveis que parecem não estar anotados como cadeiras. Isso limita a interpretação dos FP; **não reclassificamos os rótulos após olhar o resultado** nem usamos essa hipótese para aprovar um modelo. É necessário revisar anotações com avaliadores independentes e incluir cenas brasileiras.

Pesos e procedência conferidos em 23/10/2026: [RF-DETR ONNX](https://huggingface.co/onnx-community/rfdetr_nano-ONNX), revisão `eae21cee0687a91bcf9fa071605c48d7705d2d91`, SHA-256 `2981aa0a57781c0f1a5be171c3fded504c38fe8611326bc5e3d0f8a2e9a57085`; [D-FINE ONNX](https://huggingface.co/onnx-community/dfine-nano-coco-ONNX), revisão `89df95b0e8575ff9879f13351bafe69bbe8e6823`, hashes uint8 `5dca767237986666c7ba4488c1ae839c2fe5bf0dbfa24c5238840a47eb496578` e F32 `f7febe9695cd6f71120abbeb0642d3d6b6c6bcc36f0ba1d79b66d302b5860814`. Ambos os cartões indicam Apache-2.0, mas ainda falta conferir a proveniência exata dos checkpoints antes de uma distribuição. ONNX Runtime Web 1.30.0 é MIT e já estava fixado no projeto; [documentação oficial WebGPU](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html). Alternativa de menor risco: preservar YOLOX e medir outros perfis de execução, como feito aqui. Os pesos experimentais ficaram em `artifacts/`, fora do build e do Git.

## Verificação de engenharia

- `npm test`: 161/161 passaram, com build; build final repetido gerou ZIP de 167.438.028 bytes / 83 arquivos.
- `npm run typecheck` e `npm run lint`: passaram.
- `node tools/simulate.mjs`: seis transcrições; regras de fala não foram alteradas.
- `node tests/e2e/people.mjs --fixtures`: passou em GPU e CPU; foto pública, câmera e voz simuladas, modelos reais.
- `node tests/e2e/scenes.mjs --fixtures`: passou; inclui combinação de objetos WebGPU e ambientes WASM.
- `node tests/e2e/smoke.mjs http://127.0.0.1:8080 --fixtures`: passou; usa arquivos locais servidos pelo teste, sem verificar servidor HTTP.

**Não testado:** webcam física nesta revisão; voz audível/leitor de tela; fotos do ambiente do usuário; uso de 30 min, RAM, bateria, outros PCs/navegadores/celulares, GPU perdida durante a sessão, instalação/offline completos, detector híbrido real, qualidade de cenas brasileiras, reconhecimento de porta/degrau e aceite por pessoas cegas. CA-D1/CA-H4 não estão aprovados para o sistema completo: somente a inferência de objetos neste PC e fixture ficou abaixo da meta. Nenhuma chamada paga, envio de imagem, mudança de orçamento ou publicação foi feita.
