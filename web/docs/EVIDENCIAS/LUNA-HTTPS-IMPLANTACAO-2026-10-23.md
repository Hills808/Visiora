# CA-L2/L3 — origem HTTPS protegida (23/10/2026)

**Escopo executável:** teste em `tests/luna-gateway.test.mjs` verifica origem HTTPS exata, rejeição de origem divergente e CSRF, mantendo simulação `fake` sem env de chave. A configuração de `deploy/compose.yml` adiciona autenticação obrigatória e volume persistente para o ledger; o arquivo de autenticação real é privado e não existe no repositório.

**Resultado nesta etapa:** código/infraestrutura preparados no GitHub. Testes de CI aguardam execução; nenhum deploy HTTPS, Docker real, câmera/voz, hardware externo, conta Cloudflare, serviço hospedado ou chamada de API foi executado daqui. A publicação Site continua estática.

**Gate manual obrigatório antes de liberar Luna:** 401 sem senha em `/` e `/api/vision/status`; 200 autenticado no status; POST externo/CSRF inválido rejeitado; concorrência mantém uma reserva; reinício preserva ledger; regra de data retorna aos US$ 2; navegador móvel com HTTPS/câmera/voz; usuário consentiu com envio de imagens. Atualizar esta evidência com resultados observados.
