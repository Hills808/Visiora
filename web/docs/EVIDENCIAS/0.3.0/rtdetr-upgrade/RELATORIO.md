# RT-DETRv2 R18 — comparação limitada no Visiora

O RT-DETRv2 uint8 executou em CPU e WASM, mas a política escolhida no desenvolvimento não melhorou as três classes em conjunto na confirmação. Não há base nesta avaliação para trocar automaticamente o detector do produto.

## Origem e licença

Original primário: `PekingU/rtdetr_v2_r18vd`, revisão `5650961749fa93567c0d46fc7f43ea4f9e914107`.

Conversão primária: `onnx-community/rtdetr_v2_r18vd-ONNX`, revisão `936f90b6a476c6da4dfe053fc521af55285976ba`. Os dois cards declaram Apache-2.0; o LICENSE do repositório oficial foi salvo. Hash e tamanho dos pesos foram conferidos contra a metadata HF do snapshot.

| Variante | Bytes | SHA256 |
|---|---:|---|
| f32 | 81057510 | `583a236ac21c95a7fd94f284fc21485e42355bfef82c27011ba78fbc09ee87e2` |
| uint8 | 20991219 | `4b839c46187b77fc620c770de0be6790637b98afde9b386232b0fcf74382eb3c` |

## Contrato verificado

RGB, redimensionamento bilinear da imagem inteira para 640×640, rescale 1/255, sem letterbox, padding ou normalização ImageNet. Comparação do tensor com RTDetrImageProcessor oficial Transformers4.57.6: diferença máxima5,96e-8; tolerância1e-6 passou. Saídas logits[1,300,80] e pred_boxes[1,300,4], com caixas cxcywh normalizadas. A ordem id2label do config foi conferida: pessoa0, cadeira56, cama59.

Pós-processamento focal oficial: sigmoid e top300 do achatamento query×classe, sem NMS. Nosso protocolo remove somente repetições da MESMA query, mantendo sua maior classe, para não apresentar a mesma caixa sob nomes diferentes. Isso é uma diferença explícita em relação ao output oficial. Queries diferentes não passam por NMS; suas duplicatas contam como FP quando não correspondem a outra anotação. Em seguida: caixas no tamanho original, clipping, classes já mapeadas no produto e máximo30 global antes de filtrar os três alvos. Nenhum alvo é favorecido.

Foram removidas15 repetições de mesma query acima do score0,45 em cada variante nas60 imagens de desenvolvimento e7 na confirmação uint8. Os dados brutos registram essas contagens por imagem.

Correspondência de caixas reutiliza a avaliação anterior: IoU≥0,50 para anotação normal livre; depois IoA≥0,50 da detecção com crowd da mesma classe permite ignore. Detecções em ordem de score. Não há reinterpretação de anotações nem exclusão de tamanhos difíceis.

## Seleção usando somente60 imagens de desenvolvimento

Grade congelada antes de inferir: 0,45 a0,90 com passo0,05. Para cada classe, buscar precisão≥0,90 com ao menos5 predições não ignoradas, maximizando recall, depois precisão e limiar menor. A variante precisa atender às três classes; entre elegíveis, maior recall médio. Havia fallback0,85 pré-declarado, mas não foi necessário. O arquivo selection.json foi congelado antes das30 imagens de confirmação.

| Variante | Classe | Score escolhido dev | TP | FP | FN | Precisão dev | Recall dev |
|---|---|---:|---:|---:|---:|---:|---:|
| f32 | person | 0.55 | 79 | 7 | 23 | 91.9% | 77.5% |
| f32 | chair | 0.80 | 21 | 1 | 56 | 95.5% | 27.3% |
| f32 | bed | 0.90 | 5 | 0 | 8 | 100.0% | 38.5% |
| uint8 | person | 0.55 | 81 | 7 | 21 | 92.0% | 79.4% |
| uint8 | chair | 0.75 | 21 | 2 | 56 | 91.3% | 27.3% |
| uint8 | bed | 0.80 | 7 | 0 | 6 | 100.0% | 53.8% |

A regra escolheu uint8: recall médio53,5%, contra47,7% no F32. Isso não demonstra equivalência nem superioridade geral da quantização. Em score0,50, por exemplo, F32 pessoa89TP/11FP/13FN, enquanto uint8 pessoa86TP/15FP/16FN. Os efeitos são distintos por classe e limiar.

## Confirmação30, sem novos ajustes

| Modelo/política | Classe | TP | FP | FN | Precisão | Recall | Imagens negativas com FP |
|---|---|---:|---:|---:|---:|---:|---:|
| Nano .50 anterior | person | 27 | 3 | 27 | 90.0% | 50.0% | 1/18 |
| Nano .50 anterior | chair | 7 | 2 | 15 | 77.8% | 31.8% | 1/16 |
| Nano .50 anterior | bed | 3 | 0 | 4 | 100.0% | 42.9% | 0/23 |
| RT-DETR uint8 selecionado | person | 44 | 5 | 10 | 89.8% | 81.5% | 0/18 |
| RT-DETR uint8 selecionado | chair | 5 | 5 | 17 | 50.0% | 22.7% | 2/16 |
| RT-DETR uint8 selecionado | bed | 4 | 1 | 3 | 80.0% | 57.1% | 0/23 |

A meta90% usada no desenvolvimento não se manteve nas três classes: pessoa89,8%, cadeira50%, cama80%. A cobertura de pessoa e cama aumentou em relação ao Nano, enquanto cadeira perdeu precisão e cobertura. Na imagem78915 ocorreram quatro cadeiras sem anotação e, na172877, uma. Esses casos continuam FP. Os cinco FP de pessoa ocorreram em imagens que já tinham pessoas anotadas; isso não os transforma em acertos.

## Comparação conservadora adicional: apenas desenvolvimento

O pedido adicional de meta95% e de limitar erros ao Nano chegou após selection.json e após iniciar a execução da confirmação. Portanto conservative-development.json está marcado como desenvolvimento suplementar; não altera a seleção primária e não é apresentado como teste de confirmação. Usa a mesma grade, sem novos modelos ou pesos.

| Variante/política | Classe | Limiar dev | TP | FP | FN | Precisão dev | Recall dev |
|---|---|---:|---:|---:|---:|---:|---:|
| f32/target95 | person | 0.65 | 72 | 2 | 30 | 97.3% | 70.6% |
| f32/target95 | chair | 0.80 | 21 | 1 | 56 | 95.5% | 27.3% |
| f32/target95 | bed | 0.90 | 5 | 0 | 8 | 100.0% | 38.5% |
| f32/atMostNanoFalsePositives | person | 0.65 | 72 | 2 | 30 | 97.3% | 70.6% |
| f32/atMostNanoFalsePositives | chair | 0.90 | 7 | 0 | 70 | 100.0% | 9.1% |
| f32/atMostNanoFalsePositives | bed | 0.75 | 8 | 1 | 5 | 88.9% | 61.5% |
| uint8/target95 | person | 0.65 | 72 | 3 | 30 | 96.0% | 70.6% |
| uint8/target95 | chair | 0.90 | 9 | 0 | 68 | 100.0% | 11.7% |
| uint8/target95 | bed | 0.80 | 7 | 0 | 6 | 100.0% | 53.8% |
| uint8/atMostNanoFalsePositives | person | 0.70 | 63 | 0 | 39 | 100.0% | 61.8% |
| uint8/atMostNanoFalsePositives | chair | 0.90 | 9 | 0 | 68 | 100.0% | 11.7% |
| uint8/atMostNanoFalsePositives | bed | 0.80 | 7 | 0 | 6 | 100.0% | 53.8% |

No uint8, o alvo95% exige cadeira0,90:9TP/0FP/68FN, recall11,7%. A política com no máximo os FP do Nano escolhe pessoa0,70, cadeira0,90 e cama0,80; pessoa fica63TP/0FP/39FN no desenvolvimento. Precisão observada alta com tão poucos acertos e tanta omissão não estabelece precisão real nem utilidade suficiente.

## Execução e tempo

| Variante nativa | p50 CPU | p95 CPU | Amostras |
|---|---:|---:|---:|
| f32 | 687.2 ms | 918.6 ms | 60 |
| uint8 | 933.6 ms | 1196.2 ms | 60 |

ORTCPU1.23.2, uma thread, uma passada, primeira chamada incluída, computador compartilhado. São tempos exploratórios apenas de inferência; não concluir que uint8 acelera o modelo. Ambos executaram sem erro de kernel.

No navegador HeadlessChrome155, ORTWeb1.30.0/WASM/uma thread: modelo uint8 carregou e inferiu uma imagem pública, outputs finitos, zero pageerror. Uma chamada fria: carga1171.5ms e inferência1515.6ms. Isso prova execução nesse fixture e não latência de webcam ou equivalência do resize canvas com PIL. Service workers ficaram bloqueados no transporte de QA.

## Limites e arquivos

São60dev+30confirmação estratificadas já usadas na comparação YOLOX. As30 são novas em relação ao desenvolvimento, mas COCOval2017 é dado de validação conhecido dos modelos. Não é prevalência real, mAP ou prova independente de generalização. Há somente sete camas na confirmação.

Não foram testados: foto privada, câmera real, fala audível, leitores de tela, celular, ambientes brasileiros, bateria, uso prolongado, offline real ou desempenho controlado. Nada foi alterado em produto/public/Git/Sites.

- protocol.json, selection.json: regras e escolha congeladas.
- development-results.json, confirmation-results.json: caixas e contagens reais.
- conservative-development.json: comparação adicional apenas dev.
- preprocessing-check.json: comparação do tensor ao processador oficial.
- browser-compatibility.json: execução WASM real e seus limites.
- source-snapshot.json, model-sources.json, references.json, LICENSE: origem, hash e licença.
- summary.json: resumo estruturado; logs e scripts ao lado para reprodução.
