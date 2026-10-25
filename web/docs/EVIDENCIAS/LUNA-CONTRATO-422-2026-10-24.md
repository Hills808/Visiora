# Luna HTTP 422: contrato e diagnóstico — ADR-047 (24/10/2026)

Critérios: CA-L1/L2/L3/L4. Escopo: resposta estruturada, validação, motivo de pausa e preservação financeira; não é avaliação de reconhecimento.

## Evidência real que motivou a correção

Consulta somente leitura aos registros de produção encontrou duas análises às 20:03:35 e 20:04:08 de 24/10/2026 (America/Sao_Paulo). Ambas verificaram o modelo gpt-6-luna e terminaram com `invalid-evidence`; o servidor respondeu HTTP 422. Portanto, neste caso a resposta do provedor chegou e foi recusada pelo contrato semântico. Não há evidência de falta de crédito, falha da câmera ou chave ausente. Não se guardam imagem nem resposta original: o campo exato que causou cada recusa é desconhecido e não pode ser reconstruído desses registros.

As duas reservas incertas de US$ 0,30 permanecem intactas. Não houve reconciliação, liberação de reserva, alteração de chave ou aumento do teto. O agente não chamou a API paga nem reenviou a imagem privada.

## Correção

O esquema enviado permitia representações que o validador recusava. A preparação compartilhada passa a aceitar espaços equivalentes, Unicode NFC e um único ponto terminal nos campos auxiliares. Não remove perguntas, exclamações ou reticências; não altera texto OCR. IDs internos ASCII compatíveis podem ser renomeados por correspondência bijetiva, verificando previamente as referências originais. Não recorta caixas, não apaga observações, não inventa referência, posição ou distância. Caixas vazias/fora dos limites, tipos inválidos, autorrelações e referências inexistentes continuam recusados.

O esquema/prompt agora especifica IDs, suporte de cena não vazio e dimensões positivas. Somas de coordenadas e integridade entre referências continuam verificadas no código. Falhas passam a retornar motivos categóricos fechados (`invalid-evidence-box-bounds`, por exemplo); cliente e ledger aceitam somente a lista explícita. Conteúdo arbitrário, HTML ou texto do provedor não são exibidos. Não existe nova tentativa paga automática para erro de contrato. Prompt `visual-v1.2-contract`, diagnóstico `adr-047`; nenhum novo modelo ou biblioteca.

## Execuções nesta máquina

- `npm test`: 227/227, sem falhas. Inclui normalização sem mutar entrada, geometria, colisão de referência, Unicode, OCR e pontuação de incerteza.
- `npm run typecheck` e `npm run lint`: passaram no cliente/gateway.
- Hospedado: TypeScript e lint passaram; testes policy, connection, workerd e lifecycle: 11/11. Runtime workerd real com provedor substituído; não acessa OpenAI.
- `node tests/e2e/luna.mjs`: 12 cenários, nove chamadas ao provedor fake, zero erros. Câmera artificial → HTTP real em loopback → parser real → fala substituída. Inclui normalização aceita e caixa inválida recusada com motivo específico.
- Simuladores local e memória executados; a comparação com as transcrições versionadas está registrada abaixo.

Artefatos locais reproduzíveis: artifacts/contract-unit.log, artifacts/contract-hosted.log e artifacts/e2e-luna/result.json. Não contêm imagem privada. Revisão independente Astra: sem bloqueadores concretos no diferencial; não reexecutou as suítes. Sol implementou os erros do cliente e os sete testes isolados; coordenação integrou contrato, backend, E2E e publicação.

## Limites e próximos testes

Não executado: nova análise paga, câmera/voz físicas, reteste da sessão do usuário, iPhone/Android, caminhada, precisão, disponibilidade da API ou aceite CA-A4/A5. Publicação bem-sucedida não comprova o fim da falha real. Se persistir, registrar o novo motivo específico, sem guardar a imagem.

Pendência separada identificada em revisão: pessoa sem caixa (`box:null`) pode ser omitida pelo agrupamento narrativo e resultar em uma afirmação de não identificação. Não foi introduzida nem corrigida por esta fatia; não converter geometria inválida em null como recuperação. Requer teste e correção próprios antes de ampliar afirmações sobre ausência de pessoas.

Simulador local executado; simulador de memória idêntico ao JSONL versionado de 24/10/2026, comparação estrutural linha a linha.
