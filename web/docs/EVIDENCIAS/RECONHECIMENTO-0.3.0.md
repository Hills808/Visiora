# Reconhecimento e validade da fala — 0.3.0

Data: 18/10/2026. Implementação experimental local, sem API paga. Esta evidência não declara produto seguro, validado ou acessibilidade comprovada.

## O que mudou e o que os dados permitem dizer

Ambientes passam por acordo entre SigLIP2 q4 e Places365 na imagem inteira. Não recebem pistas dos objetos. Em 40 imagens novas e sem recalibração: **16 acertos, 1 erro, 23 dúvidas**, contra **14/1/25** da política anterior na mesma amostra e com as mesmas famílias de nomes. Ganho líquido pequeno: nove acertos novos, sete acertos antigos omitidos. A meta de 95% **não foi confirmada**. Por nome bruto exato, ambos acertaram 14 respostas. Só 34 categorias têm nomes compatíveis; isso não é análise aberta.

Pessoas passam por acordo de dois de três YOLOX, mantendo Nano nas outras classes. Nas 30 novas fotos COCO, com protocolo anterior à inferência:

| Classe  | Antes: acerto / falso / omissão | Agora: acerto / falso / omissão |
| ------- | ------------------------------: | ------------------------------: |
| Pessoa  |                     24 / 6 / 32 |                     29 / 5 / 27 |
| Cadeira |                      6 / 1 / 49 |                      6 / 1 / 49 |
| Cama    |                       3 / 0 / 3 |                       3 / 0 / 3 |

Somente um falso de pessoa a menos. Os modelos podem concordar em erro. Cadeiras continuam sendo uma falha importante. Nenhum caso desse conjunto atingiu o limite global de 30; sua competição é coberta apenas pelo teste de lógica específico.

Antes da fala, o cérebro confere novamente presença/setor dos objetos e lugar. Consulta descartada é refeita; memória antiga permanece explicitamente antiga. Diagnóstico registra IDs e tempos da captura, sem nomes, texto ou imagens. A tela mostra a idade da descrição. Silêncio entre mudanças é intencional.

## Verificação executada

| Critério ligado à mudança  | Resultado executado                                                                                                                                                                             | Limite                                                                                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA-F4/F6, dados vencidos   | 5 testes novos de fila, presença, setor, lugar retirado, memória antiga e proveniência passaram                                                                                                 | Não é teste de áudio real                                                                                                                                                                                                              |
| CA-F1/F2/F3/F5/F7/F8/F9/P6 | 73 testes automáticos passaram; seis transcrições do simulador iguais às anteriores, comparadas em UTF-8                                                                                        | Simulação não mede qualidade da câmera                                                                                                                                                                                                 |
| CA-P3/P4                   | Comparações pessoa30 e ambientes40 acima, protocolos e dados por imagem preservados                                                                                                             | Não atende ao ensaio de 10 min de fantasmas nem conjunto brasileiro do plano                                                                                                                                                           |
| CA-D1/D4                   | Três modelos de objetos aquecidos medidos: 1.335,3 / 1.312,0 / 1.318,0 ms, incluindo resize e pós-processamento                                                                                 | Três imagens públicas sem pessoa; CA-D1 não cumprido                                                                                                                                                                                   |
| CA-D1/D4, integração       | Cinco pesos reais em dois workers: 10 quadros de objetos 1.290–1.411 ms, quatro análises de lugar 1.524–1.647 ms; zero quadro recusado nesse fluxo                                              | Fixture positiva de banheiro; sem câmera ou voz reais. Não cumpre p95 ≤400 ms                                                                                                                                                          |
| CA-F1/F4/F9                | 6 casos de integração de ambientes passaram: falha de download explícita, nova tentativa, reconhecimento temporal, silêncio e consulta, diagnóstico/parada, geração do ZIP e requisições locais | Erro de carga induzido intencionalmente; contador diagnóstico `errors=1` corresponde a esse caso                                                                                                                                       |
| CA-E1/E5/S3/S4             | 9 casos gerais de integração passaram, incluindo tela inicial/mobile, demonstração, consulta, ajustes/histórico, objetos reais com vídeo falso, parada/apagar, texto para leitor e axe          | Sem CI, leitor real ou auditoria completa de rede/disco. Axe sem violações sérias/críticas no estado ensaiado não comprova acessibilidade                                                                                              |
| CA-F3/F6/P6/D4             | 5 casos adicionais com pessoas passaram: consenso chega à memória e à saída, idade da descrição visível, mobile sem rolagem lateral, quadros recentes e parada                                  | Foto pública COCO23899 como vídeo falso; não mede exatidão da contagem de pessoas. Execução final após limpeza dos canvases na parada: objetos 1.319/1.447/1.523 ms, uma análise de lugar 1.576 ms, zero quadros recusados nesse fluxo |
| CA-E1/E4                   | TypeScript estrito e regras/sintaxe passaram. Cinco modelos com fontes, licenças e SHA-256; sem biblioteca de runtime nova                                                                      | Lockfile e instalação limpa continuam pendentes                                                                                                                                                                                        |

As inferências da integração de banheiro ocorreram com os dois workers ativos. Seus tempos são medidos pelo aplicativo e excluem transferência completa câmera→fala. Não são percentis confiáveis de desempenho geral. O ensaio nativo dos modelos de lugares em 40 imagens teve soma p50 exploratória de 116,7 ms; não confundir com WASM ou câmera.

Capturas desktop e mobile foram inspecionadas. O campo de idade aparece sem sobreposição ou rolagem horizontal nas duas condições. São verificações visuais do layout, não avaliação com usuários cegos ou baixa visão.

O acesso HTTP loopback expirou após 10 s e a abertura integrada da prévia falhou. Chrome instalado foi usado com transporte de arquivos substituído pelo teste, câmera pública falsa e voz simulada. Service worker ficou bloqueado nesses testes. O salvamento nativo de Blob foi cancelado pela infraestrutura na investigação anterior; aqui são conferidos os bytes gerados, sem afirmar que o download nativo foi salvo.

## Pesquisa preservada e reprodução

`0.3.0/scene-consensus/`: protocolo, desenvolvimento96, escolha congelada, seleção de 40 fotos novas por hash e todas as previsões. Famílias definidas antes das previsões; `office→computer_room` continuou erro. Nenhuma união/fallback com as respostas isoladas do Sig foi confirmada.

`0.3.0/person-consensus/`: protocolo, fontes/hash/licenças das 30 fotos, todas as 48 classes mapeadas antes do limite, resultados e ensaio WASM. Composição JavaScript/Python do experimento: 166 detecções, diferença máxima zero. O módulo TypeScript do produto também foi confrontado com todos os 30 resultados congelados (`tests/fixtures/person-consensus.json`), sem fotografias.

`detector-upgrade/`, `rtdetr-upgrade/`, `consensus-upgrade/`, `scene-upgrade/`, `open-analysis/` preservam comparações rejeitadas, sem trocar decisões após ver os erros. SmolVLM256/500 não atendeu geração pt-BR/afirmações; FP16/F32 aumentou muito o peso por ganho pequeno; trocas gerais de detector pioraram cadeiras. Detalhes, versões e alternativas nos ADR-014/015.

Os scripts nesses diretórios são snapshots de pesquisa, preservados sem editar o protocolo após conhecer a confirmação. Para reproduzir, copie cada grupo de volta para `artifacts/<grupo>` na raiz do checkout. Eles dependem dos arquivos públicos originais, não incluídos. As imagens COCO vêm das URLs oficiais e IDs dos protocolos, com anotações COCO2017 e licença individual. Para cenas, `keremberke/indoor-scene-classification@030dcb9ec61c436299b1df10d90ae1cbe1d1b401`, fotos agrupadas pelo nome original antes de `.rf.`, ordem SHA-256, oito classes. Arquivos train/valid/test são apenas arquivos de origem, não os splits experimentais. Desenvolvimento0–11; confirmações anteriores12–16 e17–21; consenso22–26.

Runtime nativo observado: Python3.11.9, NumPy1.26.4, Pillow12.2.0, ONNX Runtime1.23.2/CPU. Exportação Places: Torch2.10.0+cpu, torchvision0.25.0+cpu e ONNX1.20.1 isolados em `artifacts/scene/python-deps`, não instalação global. Produto: ORTWeb1.30.0/WASM uma thread por worker. Pacotes opcionais de pesquisa não são requisito do aplicativo.

`tools/prepare_recognition_models.mjs` só divide pesos adicionais com hash fixo; não baixa, treina ou altera pesos. `tools/benchmark_places.py` contém a exportação F32. `public/models/*/manifest.json` fixa arquivos e partes; licenças e atribuições acompanham o pacote. Nenhuma foto de pesquisa ou privada foi incluída em public/dist/ZIP.

## Não testado

Câmera real com os cinco modelos, foto privada no aplicativo atualizado, ambiente brasileiro consentido, qualidade das outras categorias, pessoas cegas/baixa visão, áudio audível, NVDA/VoiceOver/TalkBack, celular físico, erro angular/profundidade, alertas/percurso, latência sincronizada até a voz, RAM, bateria, 30 min de uso, GPU, instalação limpa, CI, rede desligada/cache/service worker e integração em navegador do site publicado. Não há evidência para prometer precisão geral, segurança ou acessibilidade validada.

## Pacotes e checagem final

Os dois ZIPs passaram CRC e verificação SHA-256 dos cinco modelos reconstruídos e dados auxiliares, sem fotografias. O ZIP do build final tem 66 arquivos, versão 0.3.0 e 160.710.445 bytes; o gerado pelo navegador tem 161.307.091 bytes. São compactadores diferentes. O ZIP de navegador foi gerado antes dos últimos ajustes de versão visual e limpeza dos canvases; não se afirma identidade completa entre os dois. O pacote final do build contém esses ajustes. Relatório em 0.3.0/zip-check.json; repetição com python tools/verify_package.py <arquivo.zip>.

Maior arquivo estático: 20.000.000 bytes, abaixo do limite individual da hospedagem. O verificador Python novo passou Ruff e mypy 2.4.0 --strict. Mypy e dependências foram obtidos de wheels oficiais com SHA-256, isolados em artifacts, sem instalação global ou dependência no aplicativo; fontes/licenças em python-types-sources.json.
