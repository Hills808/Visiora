# CA-L2/L3 — origem HTTPS protegida (23/10/2026)

**Escopo executável:** teste em `tests/luna-gateway.test.mjs` verifica origem HTTPS exata, rejeição de origem divergente e CSRF, mantendo simulação `fake` sem env de chave. A configuração de `deploy/compose.yml` adiciona autenticação obrigatória e volume persistente para o ledger; o arquivo de autenticação real é privado e não existe no repositório.

**Resultado nesta etapa (CI no GitHub, sem custo de API):**
- Workflow [Visiora web #40029647062](https://github.com/Hills808/Visiora/actions/runs/40029647062): **sucesso** em build/testes automatizados, tipos, lint, transcrições simuladas e auditoria de acessibilidade no Chromium.
- Workflow [Visiora Luna deployment smoke #40029647047](https://github.com/Hills808/Visiora/actions/runs/40029647047): **sucesso** em build real da imagem Docker, validação do manifesto Compose, validação da configuração Caddy com senha fictícia, inicialização do gateway em modo fake, status HTTP/CSRF e ausência de porta publicada diretamente no teste do contêiner.
- Não foram testados proxy HTTPS com certificado real, login HTTP Basic em navegador, persistência do orçamento após reinício do volume, webcam/voz reais, chamada de API paga ou aparelho externo. O Site chatgpt.site continua estático; nenhum deploy público foi executado.

**Gate manual obrigatório antes de liberar Luna:** 401 sem senha em `/` e `/api/vision/status`; 200 autenticado no status; POST externo/CSRF inválido rejeitado; concorrência mantém uma reserva; reinício preserva ledger; regra de data retorna aos US$ 2; navegador móvel com HTTPS/câmera/voz; usuário consentiu com envio de imagens. Atualizar esta evidência com resultados observados.
