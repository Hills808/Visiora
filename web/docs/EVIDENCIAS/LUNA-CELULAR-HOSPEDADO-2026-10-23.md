# Luna hospedado — teste técnico de 23/10/2026

Critérios relacionados: CA-E4 (acesso por outro dispositivo), CA-L4 (gateway Luna), CA-S4 (privacidade e consentimento). Os critérios não estão completos sem ensaio físico.

- Build Luna privado: 62 arquivos; ZIP local auxiliar de 10.435.836 bytes. A versão pública local continua com pesos próprios.
- Build Vinext/Worker: cinco etapas concluídas; rotas `/`, `/api/vision/status`, `/api/vision/analyze` presentes.
- Migração D1 local: seis comandos SQL executados.
- Preview HTTP em loopback: `/` 200, somente Luna no seletor, `/models/manifest.json` 404, status fake 200 com token de 64 caracteres.
- `tests/hosted-smoke.mjs`: anônimo 403, CSRF ausente 403, análise fake 200, repetição do mesmo pedido 409.
- Nenhuma imagem foi gravada no D1; o teste usou JPEG branco de 16 × 16 pixels.
- Nenhuma chamada paga da OpenAI foi feita pelo agente.
- Site privado publicado em `https://visiora-luna-hills808.hills808.chatgpt.site` com revisão 3 do ambiente (chave secreta, ativação e US$ 2/dia).
- Requisição anônima a `/api/vision/status` em produção retornou HTTP 401. Na sessão autenticada do Chrome, a tela mostrou apenas Luna e a mensagem “Luna configurado. Imagens autorizadas podem ser enviadas à OpenAI e gerar cobrança.” Consentimento permaneceu desmarcado e a câmera não foi iniciada.
- Gateway local na porta 8080 foi encerrado por PID identificado e `.env` local teve `VISIORA_LUNA_ENABLED=0` e `VISIORA_DAILY_USD=0`, sem revelar a chave. O ledger local permaneceu preservado.
- Fonte hospedada reproduzida de `hosting/luna` no repositório GitHub; build sem pesos locais concluído em outra cópia, com 62 arquivos e cerca de 10 MB no ZIP auxiliar.
- Na cópia GitHub: build, tipos e lint da hospedagem passaram; preview fake repetiu 403/403/200/409, página 200 apenas com Luna e `/models` ausente. `npm test` do web padrão passou com 163 testes e manteve o pacote local completo (85 arquivos).

**Não testado:** login real por celular, permissão física da câmera, fala audível, resposta paga da API, faturamento, concorrência entre aparelhos, estabilidade prolongada, precisão visual e avaliação com pessoas cegas. O resultado fake prova integração e controles, não a qualidade do Luna.

## Correção do acesso pelo site público, 23/10/2026

Auditoria com agentes separados de hospedagem e frontend: o site público era estático; `/api/vision/status` nele retornava `200 text/html` em vez do JSON exigido por `luna-client.ts`. A interface tentava iniciar Luna na origem errada e mostrava “Luna aguarda configuração do servidor”. O gateway privado já estava publicado e, na sessão autenticada do Chrome, mostrou “Luna configurado”. Sem sessão, seu status retornou 401.

Foi publicada uma nova versão do site público que oferece um link acessível “Abrir Visiora com Luna 6” para o Site privado e deixa de oferecer Luna como opção inoperante no seletor público. O link foi clicado no Chrome e abriu a página privada com status pronto. A versão pública continua oferecendo modelos locais.

O gateway hospedado privado recebeu a mesma exceção de orçamento da apresentação: US$ 10 no dia 23/10 em `America/Sao_Paulo`, incluindo gastos anteriores desse dia, e US$ 2 a partir de 24/10. O ambiente continua configurado com `VISIORA_DAILY_USD=2`; a exceção depende da data no servidor. O teste `tests/hosted-policy.test.mjs` cobriu as duas fronteiras de meia-noite, zero e valor inválido. Build, tipos e lint da hospedagem passaram. Os dois deploys Sites retornaram `succeeded`.

O consentimento ficou desmarcado e a câmera não foi iniciada pelo agente; portanto, ainda não há evidência de resposta real do Luna, áudio no notebook/celular, fatura ou desempenho na sala de aula. O controle D1 é do Site privado e não compartilha o ledger SQLite do gateway local; mantenha uma única implantação Luna ativa para evitar dois tetos independentes.
