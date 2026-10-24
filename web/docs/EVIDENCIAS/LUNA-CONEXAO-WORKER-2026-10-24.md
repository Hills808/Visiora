# CA-L4 / CA-E1 — conexão Luna hospedada, 24/10/2026

O ledger de produção contém 11 falhas de 23/10, todas `provider-network`, sem modelo retornado. Logs de POST `/api/vision/analyze` mostram HTTP 503 em cerca de 417–426 ms. Não houve evidência de timeout ou de resposta de crédito esgotado. Reservas incertas foram preservadas.

O diagnóstico autenticado `/api/vision/connection`, publicado nesta revisão, consulta apenas GET `/v1/models/gpt-6-luna`, sem imagem ou geração. O runtime retornou `TypeError: Invalid redirect value, must be one of "follow" or "manual"`. A opção `redirect: 'error'` era aceita pelo Node local, mas rejeitada pelo runtime hospedado antes de enviar a requisição.

Correção: `redirect: 'manual'` na inferência e na consulta de conectividade. Respostas 3xx continuam sendo falhas; não seguimos Location nem encaminhamos o segredo a outro destino. Modelo, prompt, consentimento, atualidade, ledger e teto de US$ 2/dia não mudaram.

Regressão: `node --test tests/hosted-connection.test.mjs tests/hosted-policy.test.mjs tests/hosted-workerd.test.mjs` passou (7 testes). O último executa os módulos reais de conexão/provedor dentro de workerd/Miniflare, com upstream artificial e rede externa substituída. Exercita GET, POST Responses, contrato de evidência e bloqueio de redirecionamento. Os testes fake anteriores pulavam o provedor e não detectavam a incompatibilidade.

Publicação corrigida `f5faa13b87f683d69e6d6140d12c76b747ad3861`, deployment `appgdep_6adc4e520b8c8191b5bed0138aaae182`: GET autenticado retornou `connected`, HTTP 200. A sessão com câmera produziu dois POST HTTP 200 (6,35 s e 5,94 s), modelo retornado `gpt-6-luna`, verificação `verified`, 1.853 tokens de entrada em cada resposta e 453/502 de saída. O ledger registrou estimativas conservadoras de US$ 0,000884 e US$ 0,000924. A interface passou por Falando e Em silêncio. Não foi gravada a imagem nem a descrição. Audibilidade, precisão, telefone físico e aceite humano não foram medidos.

Ao parar a câmera, um terceiro POST foi cancelado (log `outcome=canceled`, 1.607 ms) e deixou uma reserva pendente. Correção adicional: o Worker retém a mesma Promise da análise com `ctx.waitUntil`, permitindo concluir a contabilidade mesmo com desconexão do navegador, dentro do prazo da plataforma. Isso não faz novo envio nem promete terminar após encerramento do Worker.

Reconciliação administrativa explícita: POST `/api/vision/reconcile`, identidade/Origin/CSRF, headers `X-Visiora-Reconcile-Request` (ID exato) e `X-Visiora-Acknowledge-Uncertain: 1`. Recusa reserva com menos de cinco minutos ou já concluída. Marca somente `pending` como `uncertain`, motivo `operator-reconciled`, mantendo charge, data, modelo, ID e bloqueio a reenvio duplicado. Não há reconciliação automática nem liberação de valores; o operador deve antes conferir logs e consumo. Esse endpoint depende do Site continuar restrito ao proprietário; rever autorização antes de compartilhar.

Dez testes de política/conexão/runtime/ciclo de vida passaram, além de tipagem, lint e dois testes de transporte do cliente. Reconciliação coberta com D1 local real e rotas reais, sem rede externa. O prazo de cinco minutos é uma proteção adicional, não prova de ausência de cobrança. Reservas antigas nunca foram apagadas.

## Publicação e reconciliação concluídas

Versão final de código `ccbe28ccabd5df79bc899ee7880c12506d63209f`, deployment `appgdep_6adc50b75de88191adc50a4c2d32730d`, `succeeded`. URL: https://visiora-luna-hills808.hills808.chatgpt.site. POST administrativo autenticado retornou HTTP 200, `state=uncertain`, `reservationPreserved=true`. Nova leitura do D1 confirmou **zero pending**, duas consultas complete/verified e uma uncertain/operator-reconciled de 24/10, com as 11 reservas anteriores intactas. Total conservador registrado em 24/10: US$ 0,301808, dos quais US$ 0,30 são reserva incerta, não cobrança comprovada. O teto permanece US$ 2 no fuso de São Paulo. A câmera foi encerrada.

Revisão independente por segundo agente GPT-6.1 Sol: sem bloqueador no transporte; recomendou teste no CI e reconciliação por ID sem reduzir valores, ambos implementados. O CLI pago de orquestração não foi executado. A API do produto devolveu `gpt-6-luna`; não confundir com o modelo dos agentes de desenvolvimento.

Não testados: áudio por medição independente, precisão visual, smartphone físico, leitores de tela, participantes cegos, desconexão física repetida após o waitUntil, queda da infraestrutura e fatura oficial. Não houve nova inferência para testar a reconciliação. A exportação de diagnóstico pelo navegador automatizado excedeu o prazo da ferramenta; as evidências são o estado acessível da UI, logs HTTP e ledger sem imagem/descrição.
