# Integração Luna local — 18/10/2026

Estado: primeiro incremento implementado e testado com respostas artificiais; **nenhuma chamada OpenAI ou cobrança nesta entrega**. Publicação não alterada: site privado continua 0.3, commit histórico `9ac9fadc1844145d66d4bf2b4e8d543f792b9483`. Alterações deste incremento estão no checkout, sem afirmar commit/push/deploy.

## O que foi entregue

- Seletor com Luna principal e opção local preservada. Modo Luna sob demanda, sem iniciar os cinco modelos ONNX. Nenhuma consulta de imagem automática.
- Captura JPEG inteira, proporção preservada, ID/instante/sessão; uma consulta ativa e nenhuma fila de fotografias. Heurística local de mudança invalida respostas e fala; não mede giro físico.
- Gateway Node 24 em `127.0.0.1`, mesma origem, checagem de Host/Origin/CSRF, consentimento, tamanho/estrutura/dimensões JPEG e resposta. Modelo, endpoint e limites são fixados no servidor. Chave fora do cliente; sem SDK novo.
- Prompt/schema com nomes abertos, hipótese de lugar sustentada por IDs e observações com caixas normalizadas. Validador rejeita excesso, campos extras, profundidade, HTML, caixa inválida, IDs duplicados e relações sem referência. JSON correto não prova visão correta.
- Orçamento SQLite com reserva transacional, IDs únicos, uma chamada pendente, taxa, diário/total, persistência entre conexões/reinício e tratamento conservador de falha incerta. Padrão desativado, orçamentos zero. Confirmação de preço pendente. Não há UI de reconciliação de pedido que ficou pendente após queda.
- `VisualMemory` separado do World/Scene atual, com snapshots rotulados por idade, frase de setor, artigos pt-BR, limite de palavras e repetição local da descrição concluída. Sem distância fabricada. Captura tardia acima de dez segundos é descartada; parar/mudar sessão/iniciar movimento invalida pendência. Saída antiga nunca é transformada em fato atual.
- Backend fake identificado, padrão sem observações. Fixtures positivas somente nos testes; não foram oferecidas como pistas ao modelo real ou como regras de reconhecimento.

## Execução real dos testes

Ambiente: Windows, Node **24.11.0**, Chrome instalado, Playwright Core já presente. Sem instalar dependências, baixar modelos novos ou usar imagens privadas. Os três testes de regressão local foram executados em paralelo; seus tempos são de integração sob carga, não benchmark novo.

| Execução | Resultado | Alcance |
|---|---|---|
| `node tools/test.mjs` | **91 testes passaram, 0 falhas**; build incluído | 73 anteriores + 18 novos de contrato, memória, servidor/HTTP e orçamento |
| `tsc --noEmit` | Passou | TypeScript estrito no cliente/cérebro; não cobre tipagem estática do servidor ESM |
| `node tools/check.mjs` | Passou | Sintaxe/regras locais, incluindo nova pasta `server/` |
| `node tools/simulate.mjs` | 6 transcrições locais idênticas à evidência 0.3 | Regressão de comportamento local, sem afirmar visão real |
| `node tests/e2e/luna.mjs` | **6 casos passaram**, 3 chamadas somente ao provider fake, 0 erros de página | HTTP real em loopback, captura de vídeo artificial, evidência e voz artificiais |
| `smoke.mjs ... --fixtures` | **9 casos passaram** | UI, local WASM real, histórico, reader simulado, axe desktop idle; HTTP substituído por arquivos |
| `scenes.mjs ... --fixtures` | **6 casos passaram** | Integração dos modelos locais de cena e falha/retry; não mede precisão Luna |
| `people.mjs ... --fixtures` | **5 casos passaram** | Consenso local e fala com vídeo artificial; não mede precisão Luna |

Suíte completa terminou verde após corrigir um caso de teste de cabeçalho Host (fetch não substituía o cabeçalho; corrigido para HTTP nativo), e o teste novo de frases longas detectou concordância incorreta no texto de fallback singular, corrigida antes da execução final. Não foram escondidas falhas ou reduzidos critérios.

Cobertura instrumentada do cérebro na suíte: aproximadamente **98,7% de linhas**. Não é cobertura de todo o frontend/servidor, não demonstra CA-E2 para percepção. CI remoto não executado. Nenhuma medição paga de latência, precisão, RAM, bateria ou custo.

## Novos testes mapeados

| Critérios | Evidência de lógica/integridade |
|---|---|
| CA-L1 | Vocabulário fora de catálogos, proveniência, caixa inválida, IDs e relações, recusa/incomplete/JSON malformado. Payload de provider fixo recebe bytes de imagem e não nomes do detector |
| CA-L2 | API HTTP recusa origem/CSRF/Host incorretos, falta de consentimento; não serve arquivos do servidor. Sem key em resposta. Service worker limitado a assets; segredo fora do bundle por separação de build |
| CA-L3 | Duplicação, concorrência, orçamento zero/insuficiente, rate limit, transação entre conexões, reinício com pendência, reserva após falha/uso ausente, sem retry |
| CA-L4 / CA-D4 | Descarte por idade/sessão/ordem; cancelamento cliente; parar durante análise e durante configuração não abre câmera nem permite fala tardia |
| CA-F2/F3/F6/F7/F8 / CA-P6 | Frase local de setor, artigo, qualificação de captura, limite de palavras, repetição apenas de saída concluída/disponível, nenhuma distância do modelo. Prova com dados artificiais |
| CA-F1/F4/F5/F9 | Regressões locais preservadas; online é manual e não usa SceneEstimator como fato atual. Isso não comprova esses critérios no vídeo real |
| CA-A1 / CA-S4 | Regressão desktop idle axe sem violações sérias/críticas, histórico opt-in e apagar navegador. Não é avaliação com leitor/pessoa real nem auditoria total de privacidade |

Os seis casos novos de navegador: principal/sem despacho automático/câmera→multipart→fala; repetir sem API; procura aberta sem distância; layout 390 px sem overflow; parar durante análise; cancelar início enquanto status chega. O vídeo público mostra cachorro/bicicleta, enquanto o provider fake retorna laboratório: a divergência é proposital e explícita para provar **transporte e linguagem**, nunca reconhecimento. Não usar essas capturas de QA para apresentar precisão.

## Arquivos brutos e transcrições

Em `luna-local/`: saída unitária com cobertura, relatório de navegador fake com as três falas, relatórios das regressões locais e transcrições locais. Imagens/fontes do vídeo artificial são os insumos públicos de QA já existentes em `artifacts/vision/`. Nenhuma foto privada integra esses arquivos. As screenshots geradas foram inspecionadas visualmente; não são validação de acessibilidade. O ledger de teste usou memória ou pastas temporárias dentro de `artifacts/`, removidas pelo teste, sem imagens.

## Pendências e o que não foi testado

- L05–L11: credencial real/fluxo oficial do plugin, orçamento e consentimento para piloto real, fórmula/taxas de imagem conferidas, smoke de API e benchmark independente brasileiro. Não afirmar qualidade superior ao modo local.
- Permissões da chave, compatibilidade real dos parâmetros/JSON Schema, recusas reais, uso/cobrança, retenção do provedor, latência ponta a ponta. Os mocks não detectam eventual rejeição de parâmetro pela API.
- Precisão de nomes, pessoas/contagens, caixas/direção, ambiguidades de ambientes e prompt injection escrito em fotografias. Validação estrutural não elimina alucinações/instruções em rótulos semanticamente válidos.
- Gateway ainda ESM JavaScript, sem checagem estática com tipos Node. SQLite nativo emite aviso experimental. Auth por conta no Sites, isolamento hospedado e D1 não implementados. Nenhum teste de produção/deploy.
- Nenhuma fusão da saída Luna com mapa ao vivo ou análise automática. Câmera/sensores físicos, celulares, profundidade, 360°, tempo prolongado, offline do novo modo, voz audível, NVDA/VoiceOver/TalkBack ou usuários cegos não testados.
- CA-A4/A5, CA-P4 e os limites originais de desempenho não atendidos por esta evidência. Custo zero/sem upload originais não se aplicam ao modo Luna opt-in. Não chamar produto de seguro ou validado.

Próximo passo: [CONFIGURAR-LUNA.md](../CONFIGURAR-LUNA.md), começando por chave segura, tetos e revisão de preço; depois poucas imagens públicas autorizadas. O aplicativo permanece desativado para chamadas reais até essa configuração.
