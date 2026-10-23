# Comparação local de reconhecimento de ambientes

## Decisão desta pesquisa

**Não adotar Places365, SigLIP2 FP16 ou SigLIP2 F32 nesta rodada.** Places365 não passou a política definida. FP16 e F32 aumentam bastante o download e não mostraram ganho suficiente de precisão para justificar a troca. Isso não torna o q4 atual preciso ou validado: ele também errou e deixou muitos casos sem resposta.

Nenhum arquivo do produto, configuração pública de modelos, Git ou Site foi alterado por esta tarefa. Foram usados apenas arquivos públicos de pesquisa já baixados e pesos oficiais. Não houve imagem privada, API paga, inferência na nuvem ou instalação global.

## SigLIP2: protocolo e resultados

- Mesma imagem RGB inteira, redimensionada para 224 × 224 com interpolação bilinear PIL, normalizada por `pixel / 127.5 - 1`.
- Mesmos 88 candidatos e embeddings de texto q4 existentes. SHA-256 dos embeddings: `79e6e68e003271fc0ba71e1fc2fac953169bb6c70f6aa2919d072ada439d2600`.
- 96 imagens públicas de desenvolvimento, índices 0–11 por classe no ordenamento congelado. Elas incluem imagens avaliadas em pesquisas anteriores; não são um teste independente.
- Grade congelada: similaridade mínima de 0,12 a 0,28 em passos de 0,02; margem de 0,005; 0,01; 0,015; 0,02; 0,025; 0,03; 0,04.
- Escolha conservadora: pelo menos 10 respostas, precisão de pelo menos 95% entre as respostas e no máximo 1 erro no desenvolvimento. Maximizar acertos; desempatar por precisão e menor arquivo. Categorias estritas orientam a escolha; famílias semânticas só aparecem separadas nos JSONs.

| Variante visual | Bytes | Top-1 correto no dev / 96 | Acertos / erros / dúvidas com política conservadora | CPU p50 / p95 |
| --- | ---: | ---: | --- | --- |
| q4 atual | 63.267.466 | 70 | 27 / 1 / 68 | 119 / 131 ms |
| FP16 | 186.039.516 | 74 | 28 / 1 / 67 | 190 / 254 ms |
| F32 | 371.807.752 | 74 | 28 / 1 / 67 | 131 / 172 ms |

As três políticas conservadoras escolheram similaridade mínima 0,12 e margem 0,03. O critério de desenvolvimento selecionou FP16 por ter um acerto a mais que q4 e ser menor que F32.

**Confirmação conservadora: 40 novas imagens, índices 17–21 por classe, escolhidas antes da inferência.** A seleção não tem SHA de imagem em comum com os índices 0–16.

| Modelo e limiar congelado | Top-1 correto / 40 | Respostas corretas | Respostas erradas | Dúvidas |
| --- | ---: | ---: | ---: | ---: |
| q4, 0,12 / 0,03 | 31 | 10 | 1 | 29 |
| FP16, 0,12 / 0,03 | 29 | 11 | 1 | 28 |

O FP16 não confirmou a meta de 95%: foram 11 acertos em 12 respostas (91,7%), diante de 10 em 11 no q4 (90,9%). O erro foi o mesmo arquivo, anotado como cozinha no conjunto e classificado como banheiro pelos dois. A anotação não foi alterada para melhorar a métrica. Não houve recalibração após a confirmação. O ganho de uma resposta correta não justifica quase triplicar os pesos nesta rodada. F32 não foi levado à nova confirmação porque já havia empatado com FP16 no desenvolvimento com o dobro do tamanho.

Os tempos usam ONNX Runtime nativo 1.23.2, CPU, 4 threads, apenas o codificador visual. Excluem câmera, rede, fala e uso simultâneo dos outros componentes. FP16 falhou com otimização padrão em `SimplifiedLayerNormFusion`; passou com otimização básica. A falha está preservada em `precision-run-initial-error.log`.

### Correção cronológica e experiência de 90%

Antes de chegar a orientação de política conservadora, o primeiro script já havia congelado uma política exploratória de pelo menos 90% de precisão e 10 respostas e avaliado 40 imagens dos índices 12–16. Essa sequência foi preservada em `frozen-choice.json`, `confirmation.json` e `comparison.json`.

Nessa experiência, FP16 escolheu margem 0,025 no desenvolvimento: 32 acertos, 3 erros e 61 dúvidas. Nas primeiras 40 imagens, deu 19 respostas corretas, nenhuma errada e 21 dúvidas; q4 atual deu 11 corretas, nenhuma errada e 29 dúvidas. Isso não autoriza relaxar a política de precisão: o desenvolvimento já continha mais erros. Esses 40 exemplos não foram reutilizados como confirmação da decisão conservadora; outros 40, índices 17–21, foram reservados para ela.

O script inicial também foi corrigido antes de qualquer previsão bem-sucedida: a saída global é `pooler_output`, e não a primeira saída, que contém os 196 patches. Essa correção e a falha inicial não foram ocultadas.

## Places365: reprovação preservada

O modelo ResNet18 Places365 foi reavaliado apenas nas mesmas 96 imagens de desenvolvimento, com as famílias semânticas que já estavam definidas no protocolo da pesquisa principal. A auditoria preserva previsões e toda a grade em `places-failure-audit.json`.

Política exigida: pelo menos 90% de precisão em pelo menos 10 respostas. **Nenhum dos 78 pares de limiar passou.** A melhor precisão entre pares com 10 ou mais respostas foi:

- Score 0,70 e margem 0,30: **16 corretas, 3 erradas e 77 dúvidas**, ou 84,2% de precisão entre respostas.
- O par de maior número de acertos, score 0,20 e margem 0,05, deu **51 corretas, 32 erradas e 13 dúvidas**. Isso não é uma alternativa aceitável à meta.

Este resultado usa a mesma preparação da comparação anterior: redimensionamento direto para 256 × 256, recorte central de 224 × 224 e normalização ImageNet. A conclusão se limita a essa configuração; não foi testada outra preparação para tentar resgatar o modelo. Os 40 novos exemplos conservadores não foram usados nessa auditoria de Places365.

## Origem dos pesos SigLIP2

Repositório ONNX: `onnx-community/siglip2-base-patch16-224-ONNX`, snapshot `ba1f3b0843f24bc5417d38e19c37b287d719b2f4`.

Modelo original: `google/siglip2-base-patch16-224`, revisão `75de2d55ec2d0b4efc50b3e9ad70dba96a7b2fa2`, licença declarada **Apache-2.0**. O cartão da conversão ONNX remete ao original e não declara outro campo de licença. Metadados e cartão foram preservados em `hf-snapshot.json`, `original-model-metadata.json` e `upstream-card.md`.

| Arquivo | SHA-256 |
| --- | --- |
| `vision_model_q4.onnx` | `03e61be280fb24114facd87a1e1e6b2b654aad49845686da2f930c72740914aa` |
| `vision_model_fp16.onnx` | `a1959f7bd3993a607e48839f6d01e25b876fe76afda301b028b78eef68aabd95` |
| `vision_model.onnx` | `c0573e3f4140c3a7c4e9cc5912bd6b26a033b46a6a8e8af26cbea262b163bcad` |

Os dois downloads novos foram conferidos contra tamanho e SHA-256 LFS da API oficial. Nenhum peso novo foi distribuído com o produto.

## O que não foi testado

As variantes novas não foram medidas em WASM, WebGPU ou telefone, pois não justificaram adoção com a política conservadora. Não há medição de RAM dessas variantes nem prova de que funcionem no navegador do usuário. O arquivo `browser-probe.mjs` é apenas preparação não executada e não constitui evidência.

Também não houve avaliação com webcam real, fala real, leitores de tela, usuários, ambientes brasileiros, movimentação, oclusões, pouca luz, uso prolongado ou categorias fora das oito avaliadas. Os dados são públicos, derivados de MIT Indoor Scenes, com anotações que podem ser ambíguas e sobreposição desconhecida com o pré-treino. As imagens ficam somente nos artefatos de pesquisa e não devem ser redistribuídas. As frações observadas nesta amostra não comprovam segurança, precisão geral ou acessibilidade.

## Arquivos para reprodução

- `compare_precision.py`: primeiro protocolo de 90%, desenvolvimento das três variantes e primeira confirmação.
- `confirm_conservative.py`: escolha conservadora baseada apenas no dev e nova confirmação congelada.
- `audit_places_failure.py`: dados brutos e grade da reprovação de Places365, sem baixar a meta.
- `protocol.json`, `development.json`, `conservative-frozen-choice.json`, `conservative-selection.json`, `conservative-comparison.json`: contratos e resultados completos.

Executar esses scripts usa somente a pasta do projeto e dependências nativas já disponíveis. Rodar novamente os mesmos dados não transforma a confirmação em uma nova amostra.
