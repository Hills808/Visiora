# Implementação 0.1.0 — evidências de 17/10/2026

**Estado:** protótipo em avaliação. Implementação autorizada no pedido posterior de desenvolver com Sites. Isso não conclui entrevistas, benchmark brasileiro ou validação com pessoas.

## Executado

| Verificação | Resultado real | Critérios e limite |
|---|---|---|
| `node tools/test.mjs` | **47 passaram, 0 falharam**, build incluído; log em testes-0.1.0.log | CA-F1…F9, P5/P6, D4, E2, S4: apenas aspectos simulados/unitários |
| Cobertura do cérebro | **98,71% linhas, 97,07% ramos, 95,83% funções** | CA-E2 parcial; não foi medida cobertura da percepção ≥70% |
| `node node_modules/typescript/bin/tsc --noEmit` | exit 0, sem diagnósticos | Tipos estritos; não é prova de correção dos modelos |
| `node tools/check.mjs` | exit 0 | Sintaxe MJS e regras locais; não é ESLint completo |
| Prettier 3.6.2 | código formatado; TXT excluído porque não tem parser | Consistência de formatação, sem alegar semântica |
| `python -m ruff check tools/package_local.py tools/vision_smoke.py` | All checks passed | Scripts auxiliares; mypy não executado, pacote ausente |
| `node tools/simulate.mjs` | seis transcrições gravadas em transcricoes-0.1.0.jsonl | CA-F2/F3/F7/F9 parcial; fonte explicitamente simulada |
| Chrome headless / E2E | **9 verificações passaram**, 0 erros JS | CA-A1/S4 parciais; 390 e 1440 px sem rolagem lateral, demo, busca, ajustes, histórico, exclusão, detector e texto leitor |
| axe-core 4.14.0 | zero violações sérias/críticas, estado inicial desktop | Não comprova A1 completo, teclado completo, A2/A3/A4/A5 |
| Inspeção visual | imagens desktop inicial, mobile inicial e desktop com modelo revistas | Tema claro/escuro; não substitui testes de baixa visão |
| Detector CPU real | cachorro, carro e bicicleta na única imagem pública | CA-P6/compatibilidade; não mede acurácia brasileira |
| Detector WASM real | reconheceu cachorro com vídeo falso da mesma imagem | Integração câmera falsa → worker/modelo → cérebro → síntese simulada |
| Requisições da página no E2E | apenas GET da mesma origem, nenhum upload | CA-S3 parcial; não é captura de tráfego do SO/voz |
| Arquivo local | ZIP criado com build, modelo, WASM, licenças e servidor | Teste de integridade e conteúdo separado; instalação/offline ainda pendentes |

Os testes de cena estática percorrem seis cenários × 12 sementes × cinco minutos simulados: 12% de perdas, ±6% de variação em profundidade e ±1° de variação angular. Esse ensaio específico não injeta falsos positivos; não confundir com os percentuais citados pelo protótipo antigo. Máximo de uma fala adicional após briefing. Nada disso comprova fantasma/precisão em vídeo real.

Foram acrescentadas verificações para distância sem escala, duas cadeiras distintas, limite exato de aproximação, giro e estabilização, callback interrompido/vencido, fala longa iniciada válida e saída textual que pode ser repetida **sem marcar entidade como falada**. A revisão final encontrou respostas manuais sem pausa; o ajuste impõe 600 ms mínimos em todos os canais de voz e 2400 ms para fala automática. São hipóteses em configuração, ainda sem calibração com ouvintes. Expectativas de resposta imediata foram atualizadas para essa regra.

## Ensaio de modelo

Arquivo `modelo-cpu.json`: Windows, Python 3.11.9, ORT 1.23.2 CPUExecutionProvider, quatro threads, cinco warmups e vinte repetições. Uma imagem pública 768×576 do demo YOLOX, sem câmera. Entrada 416×416; p50 10,10 ms e p95 12,55 ms de **inferência**, carregamento 77,11 ms. Não é tempo quadro→percepção/fala. Decodificação em `modelo-decodificado.json`.

Preparação errada RGB/ImageNet falhou antes; foi corrigida para BGR bruto oficial e os pesos reais foram novamente executados. Modelo WASM foi então exercitado no E2E. Profundidade permaneceu ausente.

## Como o E2E rodou

Comando: `node tests/e2e/smoke.mjs http://127.0.0.1:8080 --fixtures`.

HTTP loopback real retornou ERR_NETWORK_ACCESS_DENIED neste ambiente. O teste atende as requisições com arquivos de dist via interceptação Playwright. Usa Chrome instalado, modelo e WASM reais, vídeo YUV420 da imagem pública e síntese de voz falsa. Service workers ficam bloqueados nesse modo. `e2e-0.1.0.json` contém casos, requisições e auditoria. Não omitir essa limitação ao citar os resultados.

O vídeo de QA foi gerado da imagem pública dog.jpg, convertida para YCbCr/YUV420 (luminância inteira, crominância reduzida à metade), gravada como quadros Y4M repetidos. Não representa movimento real. O script axe foi baixado da versão exata registrada no ADR. Insumos ficam em artifacts, fora do aplicativo/distribuição.

## Infraestrutura

Npm/Sites installer falharam no ambiente Windows; pacotes oficiais foram baixados pelo transporte HTTPS disponível, com integridades conferidas, sem instalação global. Abertura do helper de origem em terminal falhou por DNS; executado o mesmo helper oficial por subprocesso no runtime de ferramentas, a abertura concluiu com código 0 e a mesma identidade. Não há mudança de identidade nem token em arquivo.

Navegador integrado falhou ao abrir. Ensaios de interface acima usam somente o processo de QA. Site ainda depende do resultado nativo de publicação; ver registro de entrega separado quando houver.

## Não executado / não comprovado

CA-A4/A5 com pessoas; NVDA, VoiceOver, TalkBack, teclado completo, contraste 7:1 e alvos em todos os estados; áudio audível; câmera/sensores reais; benchmark de 30 cenas; profundidade/escala; erros angulares; classificador de lugar; fantasmas em vídeo real; aproximação/alertas reais; latência ponta a ponta; 30 min de memória/bateria; GPU; CI; instalação limpa; serviço/porta real; inspeção de disco e captura completa de tráfego; cache offline/recarregamento desconectado.

CA-F5 está coberto com yaw simulado, **não** com giro físico no app. CA-P5 só com dados métricos simulados; alertas da câmera estão desligados. CA-E1/E3 pendentes. Nenhum resultado antigo de 40+13 testes foi reaproveitado como se tivesse sido reproduzido.
