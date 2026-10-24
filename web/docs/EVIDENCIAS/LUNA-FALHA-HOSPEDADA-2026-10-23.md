# CA-L3/L4 — diagnóstico da falha hospedada, 23/10/2026

## Evidência de campo e hipótese

O usuário mostrou webcam ativa, Luna configurado e consentimento; o acompanhamento registrou primeiro "Falha temporária. Uma nova captura será tentada em 15 segundos" e depois "Acompanhamento automático pausado. Luna não configurado, sem conexão ou temporariamente indisponível". A primeira mensagem comprova que o cliente considerou um erro transitório. A segunda mensagem **não distingue** se o servidor perdeu a configuração, se houve erro 5xx no upstream ou se a conexão Worker→OpenAI falhou. O teste fake anterior tinha verificado gateway/CSRF, não a API paga.

## Mudança nesta branch

- `hosting/luna/lib/luna-provider-errors.ts` classifica status HTTP do provedor sem incluir corpo, chave ou detalhes do pedido; erros 500/503/520/530 resultam em código `provider-http-5xx` e HTTP 503 do gateway.
- `web/src/vision/luna-client.ts` registra a categoria sanitizada em `AnalysisError.code` e mostra o código em tela. HTTP 503 não JSON, possivelmente emitido pela própria borda, é classificado como `gateway-unavailable` sem expor o HTML.
- `hosting/luna/tests/hosted-policy.test.mjs` cobre essa classificação, e `web/tests/luna-transport.test.mjs` cobre a propagação e uma resposta HTML. CI executa as duas suítes quando há alteração no PR.

## Limites e próximo teste

Nenhuma chamada paga foi iniciada para investigar; nenhum segredo, frame ou histórico privado foi enviado ao GitHub. A revisão do código é evidência da classificação implementada, não da causa específica da sessão original. **Não testado:** chamada real hospedada da OpenAI, disponibilidade no aparelho do usuário, leitura de logs de execução e medição de custos e voz. O reteste útil exige versão nova efetivamente publicada e código técnico anotado no diagnóstico exportado. Não apagar nem liberar reservas incertas automaticamente.

