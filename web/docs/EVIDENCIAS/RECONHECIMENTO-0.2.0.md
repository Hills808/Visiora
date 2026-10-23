# Reconhecimento de ambientes — Visiora 0.2.0

Data: 17/10/2026. **Protótipo em avaliação.** Pedido: melhorar reconhecimento/analise sem regras de objetos. Alteração: modelo aprendido da imagem inteira; remoção da inferência manual por objetos; dúvida explícita e processamento separado. **Ainda há catálogo finito**, não descrição aberta irrestrita. ADR-012/013 registram a pesquisa e o próximo experimento com VLM.

## Resultado que pode ser afirmado

- 58 testes automatizados passaram; tipos estritos, lint local e ruff passaram.
- Cobertura medida só do cérebro: 98,78% de linhas, 97,32% de ramos. Não inferir cobertura da percepção/worker.
- 9 verificações de regressão da interface e 6 de integração de cenas passaram em Chrome headless com câmera e voz falsas, modelos ONNX/WASM reais e HTTP substituído por arquivos.
- Confirmação com 40 fotografias públicas: **12 respostas corretas, 1 errada e 27 dúvidas**. A categoria de maior similaridade foi correta em 30/40 antes da rejeição; isso não significa que a aplicação respondeu 30 vezes corretamente.
- Nova análise não depende dos objetos detectados; espera duas capturas concordantes e recentes. Sem mudança, não repete a fala; pedido explícito pode repetir.
- Falha de download de cenas, induzida com HTTP 503, é informada e permite tentar de novo enquanto objetos continuam.
- Integridade dos ZIPs e hash do modelo reconstruído conferidos. Salvamento nativo do download no navegador não comprovado.

## Conjunto e protocolo

Fonte: `keremberke/indoor-scene-classification`, revisão `030dcb9ec61c436299b1df10d90ae1cbe1d1b401`, derivado MIT67/Roboflow. Imagens são de pesquisa, não redistribuídas com o produto. Não há fotos de usuários.

O nome do arquivo train/valid/test do fornecedor não foi tratado como partição experimental: classes estão distribuídas pelos arquivos. As três fontes foram reunidas; versões da mesma fotografia foram agrupadas pelo nome original antes de `.rf.`; ordenação determinística por SHA-256 desse nome. Por classe: índices 0..1 = desenvolvimento (16 no total), 2..6 = exploratório (40), 7..11 = confirmação (40). Classes: sala de estar, quarto, cozinha, banheiro, escritório, sala de aula, restaurante e corredor.

Catalogo/limiares q4/q4 congelados antes de rodar a confirmação. A exploração comparou quantizações e influenciou a escolha: não tratá-la como teste final independente. Alguma ambiguidade/anotação estranha foi observada e mantida, sem excluir erros para melhorar números. Sobreposição com pré-treino desconhecida. Nenhuma avaliação de precisão nas demais categorias ou de estabilidade temporal com vídeos reais.

Arquivos `cenas-*.json` preservam fonte, hash de cada imagem, ranking, aceitação e tempos. Diferenças PIL bilinear versus canvas com interpolação de alta qualidade impedem chamar a preparação dos dois runtimes de idêntica pixel a pixel.

### Confirmação detalhada

| Categoria | Imagens | Respostas aceitas | Corretas |
|---|---:|---:|---:|
| Banheiro | 5 | 4 | 4 |
| Quarto | 5 | 0 | 0 |
| Sala de aula | 5 | 2 | 1 |
| Corredor | 5 | 3 | 3 |
| Cozinha | 5 | 2 | 2 |
| Sala de estar | 5 | 2 | 2 |
| Escritório | 5 | 0 | 0 |
| Restaurante | 5 | 0 | 0 |
| Total | 40 | 13 | 12 |

O erro aceito foi sala de aula → sala de educação infantil (`classroom/img_0007_jpg.rf.3babdde2e0fcbbb68108c21b87a2a82d.jpg`). Não foi removido. Cobertura 32,5%; acerto entre respostas aceitas 12/13 apenas nesse pequeno recorte, sem sustentação para publicidade de precisão geral.

## Tempo e execução

CPU nativa: ONNX Runtime 1.23.2, CPUExecutionProvider, quatro threads; confirmação do encoder visual: p50 132,57 ms / p95 150,95 ms. Exclui câmera, transporte, preparo e voz; não é CA-D1 completo.

Browser: Chrome headless instalado, ONNX Runtime Web 1.30.0, WASM SIMD uma thread por worker. Imagem pública positiva selecionada para integração, não para estimar qualidade. Aproximadamente 1,5–1,7 s por inferência de cenas no primeiro ensaio com workers separados; valores do rerun final em `cenas-diagnostico.json`. **Excede p95 400 ms de CA-D1 nessa condição.** A separação manteve detecções de objetos durante a análise de lugar. Sem percentis de hardware representativo, energia ou RAM de pico.

Places365 ResNet18 foi exportado e executado em CPU. Resultado bruto em `places365.json`: comparação estrita de strings e categorias diferentes, não ranking justo de precisão. Filtro de desenvolvimento não passou; nenhuma correspondência semântica foi acrescentada depois de ver os resultados. Precisa protocolo alinhado e nova amostra. Alternativas de descrição aberta foram pesquisadas, não executadas.

## Testes e critérios

| Critério | Evidência desta entrega | Limite do resultado |
|---|---|---|
| CA-F9 | Testes com classificação ausente, ambígua, recente/expirada e modelo WASM real | Não estabelece acerto em ambientes brasileiros |
| CA-F1/F4 | Simulador: 6 ambientes × 12 sementes × 5 min nos testes; integração ficou 7 s sem repetir | Não substitui vídeo real estático de 5 min |
| CA-F5/F6 | Giro, estabilização, resultado assíncrono antigo, interrupção e callbacks tardios | Câmera não mede velocidade angular física |
| CA-P4 | Confirmação pública de 40 fotos, erros/dúvidas preservados | Conjunto brasileiro e precisão útil pendentes |
| CA-P6 | Testes sem depth; câmera não anuncia passos | Nenhuma distância real medida |
| CA-D1/D4 | Tempos separados; rejeição de resultado >3 s e uma inferência em voo por modelo | Cenas excedem D1; sem carga de 30 min ou latência ponta a ponta |
| CA-A1/A3 | Axe no estado inicial desktop; regressão teclado, contraste e layout | Não comprova leitores de tela, todas as telas ou WCAG completa |
| CA-S3/S4 | Fluxo headless: somente GET mesma origem, histórico opt-in e exclusão | Sem captura de tráfego do SO/produção, áudio ou service worker |
| CA-E2/E4/E5 | Cobertura cérebro, modelos/licenças/hashes registrados; ajuda atualizada | Sem cobertura de percepção completa, CI ou instalação limpa |

Não declarar um CA integralmente aceito com evidência parcial.

## Reproduzir nesta pasta

```powershell
node tools/test.mjs
node node_modules/typescript/bin/tsc --noEmit
node tools/check.mjs
node tools/simulate.mjs
node tests/e2e/smoke.mjs http://127.0.0.1:8080 --fixtures
node tests/e2e/scenes.mjs http://127.0.0.1:8080 --fixtures
```

Logs e JSONs desta execução estão nesta pasta. Sem CI. Dependências npm foram obtidas de fontes oficiais e verificadas, sem instalação global; lockfile completo e instalação limpa continuam pendentes. fflate 0.8.3 tem metadados preservados em `fflate.json`.

Para reproduzir a pesquisa opcional, obter os três ZIPs da revisão do dataset no diretório `artifacts/scene` e os arquivos exatos da revisão ONNX em `artifacts/scene/siglip`, preservando os nomes de origem. Scripts usam hashes/manifestações e gravam só artefatos locais. Bibliotecas observadas: Python 3.11.9, numpy 1.26.4, Pillow 12.2.0, onnxruntime 1.23.2, tokenizers 0.22.2; Transformers 4.57.6 foi usado para conferir tokenização.

```powershell
python tools/prepare_scene_model.py --text q4
python tools/benchmark_scenes.py --vision q4
python tools/benchmark_scenes.py --vision q4 --confirmation
```

Cada execução do benchmark escreve `artifacts/scene/benchmark.json`; preservar as variantes antes da próxima. Checkpoints textuais não vão para o produto. Preparo não usa API de inferência.

Comparação Places365: PyTorch CPU 2.10.0, torchvision 0.25.0+cpu, ONNX 1.20.1, ml_dtypes 0.5.3. A versão torchvision global era incompatível; auxiliares foram extraídos **só em artifacts/scene/python-deps**, sem alterar o ambiente global. Usar esse diretório em PYTHONPATH para `tools/benchmark_places.py`. Checkpoint lido com `weights_only=True`; código remoto não foi executado. Peso e classes vieram dos links oficiais CSAIL; hashes no resultado. Conexão HTTPS do peso falhou; foi usado o endereço HTTP publicado pelo autor, sem afirmar autenticidade criptográfica do fornecedor.

## ZIP e limites da infraestrutura

Build produz `artifacts/visiora-local.zip`. Teste de browser aciona o botão real, monta o pacote e copia os bytes gerados por instrumentação apenas de QA, porque o salvamento nativo foi cancelado até num Blob mínimo em about:blank. CRC do ZIP, presença do worker de cenas, iniciador, ausência de imagens de teste e SHA-256 das partes reconstruídas verificados com Python zipfile. Sem concluir “download nativo aprovado”.

HTTP loopback e navegador integrado falharam neste ambiente. E2E intercepta apenas arquivos estáticos, bloqueia service workers e usa vídeo público como câmera; síntese de voz é simulada. Observação de apenas GETs nesse fluxo não audita rede em produção.

## O que falta e próximo teste humano

Não testados: webcam com novo modelo, áudio audível, NVDA/VoiceOver/TalkBack, usuários cegos/baixa visão, celular físico, GPU, conjunto brasileiro, 80 categorias, distância/pose/alerta real, ponta a ponta, RAM/resistência 30 min, instalação limpa, offline, servidor/produção no browser. Não há validação de segurança/acessibilidade.

O usuário relatou câmera, pessoas, objetos e silêncio funcionando na versão anterior; isso é retorno informal, não validação controlada desta versão.

Próximo ensaio consentido: cenas reais brasileiras conhecidas e desconhecidas, enquadramentos amplos/parciais, luz ruim, ambientes parecidos, câmera estática/movendo e áudio real. Registrar acerto, erro, dúvida e demora **sem gravar imagem por padrão**. Para análise aberta, comparar VLM sem lista de lugares e avaliar cada afirmação, não só nome do ambiente. Entrevistas e critérios CA-A4/A5 continuam pendentes.
