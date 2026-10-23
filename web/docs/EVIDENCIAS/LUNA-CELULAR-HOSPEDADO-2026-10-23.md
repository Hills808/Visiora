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
