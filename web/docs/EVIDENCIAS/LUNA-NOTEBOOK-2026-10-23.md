# Luna portátil no notebook — 23/10/2026

Critérios relacionados: CA-L4, CA-E3 e CA-E4. Escopo: empacotamento e inicialização local; não comprova qualidade de visão ou aceite humano.

- Configuração atual do PC conferida sem imprimir segredo: provedor Luna pronto, chave presente e teto de US$ 2/dia.
- Node.js 24.22.1 Windows x64 baixado do arquivo oficial; SHA-256 do arquivo comparado com `SHASUMS256.txt`. Licença oficial incluída.
- `npm run package:luna-notebook`: ZIP final gerado com 136 entradas, 202.520.380 bytes, SHA-256 `e03fdcaf279c66096cd3854319bed2e73e4b35ba9678b8e19bafa9cf848c2e25`. `ZipFile.testzip()` não apontou corrupção. Nenhum `.env` ou `.runtime` no ZIP.
- ZIP extraído em uma pasta de QA; Node empacotado informou `v24.22.1`.
- Com `.env` fictício, gateway fake retornou `/` HTTP 200 e `/api/vision/status` com `ready=true`, `provider=fake` e CSRF de 64 caracteres. Sem API paga.
- Com credencial fictícia e ledger de QA, `iniciar-luna.cmd` passou pelo preflight e levantou o gateway Luna em loopback; `/api/vision/status` retornou `ready=true`, `provider=luna`, CSRF de 64 caracteres. Nenhuma requisição de análise foi enviada.
- `npm test` passou após a inclusão do empacotador; `mypy --strict`, `ruff check`, formatação Ruff, TypeScript e lint passaram. O ZIP final foi regenerado após essas verificações.

**Não testado:** notebook de destino, transferência da chave/ledger, webcam e voz reais nele, internet do local, acesso real ao modelo por essa rede, fatura e limite compartilhado em simultâneo. Antes da transferência, parar o gateway do PC; não executar nos dois aparelhos ao mesmo tempo. Não publicar o pacote depois de acrescentar `.env`.
