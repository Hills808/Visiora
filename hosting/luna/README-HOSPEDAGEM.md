# Visiora Luna hospedado

Esta implantação privada reúne o build web existente e um gateway Luna em Cloudflare Workers. O navegador usa o mesmo contrato `/api/vision/status` e `/api/vision/analyze`; imagens são processadas em memória e não entram no D1. A câmera exige HTTPS, consentimento `cloud-v3-continuity` e acesso autenticado ao Site.

## Operação

- `.openai/hosting.json` mantém o ID do Site privado e declara D1 `DB`.
- `OPENAI_API_KEY` é segredo do Site, nunca variável pública ou arquivo versionado.
- `VISIORA_LUNA_ENABLED=1`, `VISIORA_DAILY_USD` entre 0 e 2, e `VISIORA_PRICING_CONFIRMED=2026-10-23` são exigidos para chamadas reais.
- Um pedido pendente bloqueia os demais, inclusive após a meia-noite. É preciso reconciliar no ledger uma falha incerta antes de liberar novas chamadas.
- O orçamento hospedado é compartilhado entre os aparelhos que usam este Site, mas não com um gateway local SQLite. Desligue o gateway local antes de habilitar o teto hospedado para não ultrapassar o limite total autorizado.
- A alternativa `VISIORA_PROVIDER=fake` é apenas para testes locais, sem chamada paga.
- Esta página privada oferece apenas Luna; os pesos dos modelos locais foram excluídos do build (cerca de 10 MB no ZIP local gerado). A versão pública separada mantém o modo local.

## Testes

No repositório GitHub, entre em `hosting/luna` e execute `node scripts/prepare-web.mjs`, `npm ci` na pasta atual e em `web/`, depois `npm run db:generate`, `npm run build` e `node node_modules/typescript/bin/tsc --noEmit`. A migração de D1 precisa ser aplicada no preview local antes de `npm start`. `node tests/hosted-smoke.mjs http://127.0.0.1:8790` cobre autenticação, CSRF, resultado fake e duplicata. O teste não avalia precisão visual, webcam, áudio ou faturamento real.
