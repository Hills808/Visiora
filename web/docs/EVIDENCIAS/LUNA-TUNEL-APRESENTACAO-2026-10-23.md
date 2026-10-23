# Contingência Luna por túnel — 23/10/2026 (CA-L2, CA-L3, CA-E3)

## Resultado observável

- PR #14 está mesclado na main, mas a hospedagem `chatgpt.site` é estática, sem `/api/vision/status` ou gateway.
- Foi adicionado `tools/apresentacao-luna.ps1`: exige segredo e ledger existentes, recusa duas instâncias na porta 8080, inicia Quick Tunnel com autenticação por e-mail, ajusta a origem HTTPS exata e inicia `npm run dev:luna` sem alterar `.env` ou o SQLite.
- Fonte da opção `--allowed-mail`: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/ (Cloudflare; versão mínima 2026.9.3). A opção `--http-host-header` é usada para preservar a verificação de Host loopback existente no gateway.

## Roteiro de verificação ainda pendente

1. Em Windows com `.env` e `.runtime/luna-budget.sqlite` válidos, atualizar main e compilar com `npm run build`; usar cloudflared recente.
2. Rodar `powershell -ExecutionPolicy Bypass -File tools/apresentacao-luna.ps1 -Email <seu-email>` com gateway anterior parado. Conferir que URL HTTPS foi gerada e o Node iniciou no mesmo PC.
3. No celular/notebook em outra rede, conferir login pelo e-mail permitido; e-mail diferente deve ser recusado. Abrir `https://...trycloudflare.com/api/vision/status` e exigir `ready=true`, `provider=luna`, sem revelar chave.
4. Iniciar webcam e consentimento; verificar uma descrição audível atual, horário, latência e reserva no ledger. Conferir que o orçamento de 23/10 é no máximo US$ 10 já incluindo gastos prévios.
5. Parar o gateway com Ctrl+C e conferir encerramento do túnel. Em caso de falha ou rede instável, usar o pacote Windows local como contingência.

## Não testado

Nenhuma execução Windows, rede Cloudflare, navegação HTTPS, e-mail autorizado, câmera física, voz real, cobrança ou resposta Luna foi realizada nesta sessão; a conexão ao VS Code retornou `JavaScript execution requires thread-scoped Codex metadata`. Não anunciar funcionamento validado nem segurança de locomoção. Nenhum segredo foi lido ou gravado no GitHub.
