# Luna hospedado por HTTPS, com acesso privado — preparação de implantação

Esta opção entrega **o mesmo frontend e o gateway Luna na mesma origem HTTPS**, em uma máquina Linux com Docker Compose. O endereço anterior `visiora-ambiente.hills808.chatgpt.site` continua estático e **não** será alterado por este arquivo. Para usar, é necessário um servidor seu e um domínio que aponte para ele. Não há hospedagem, domínio, API ou cobrança ativados por este commit.

## Pré-requisitos

- Uma máquina/VM Linux com Docker Engine + Compose e portas 80/443 acessíveis; DNS A/AAAA do domínio apontando para ela; HTTPS emitido pelo Caddy.
- Instância **única** (não distribuir a aplicação entre réplicas); volume Docker `luna_ledger` persistente. Um ledger independente em outro computador não compartilha gastos.
- **Obrigatório se Luna já foi usado hoje no PC:** desligar o gateway anterior e transferir o ledger SQLite **antes** de iniciar o gateway hospedado. Uma base vazia reiniciaria a contagem e poderia ultrapassar os US$ 10 totais autorizados para a apresentação. Não permitir dois gateways pagos simultâneos. Sem migração conferida, manter `VISIORA_LUNA_ENABLED=0`.
- Chave OpenAI privada e tarifas conferidas segundo `docs/CONFIGURAR-LUNA.md`. Não inserir chave no navegador, repositório ou build. O controle interno limita **reservas estimadas**, não substitui as cotas do provedor.
- Credenciais privadas para HTTP Basic; todos os recursos, inclusive `/api/vision/status`, exigem autenticação.

## Configuração no servidor (na pasta `web/`)

1. Copie `.env.example` para `.env`, preencha `OPENAI_API_KEY`, `VISIORA_LUNA_ENABLED=1`, `VISIORA_DAILY_USD=2`, `VISIORA_PRICING_CONFIRMED=2026-10-18`, `VISIORA_PROVIDER=luna`. O limite excepcional de **US$ 10 em 23/10/2026** já está no código, somente nessa data; volta a US$ 2 à meia-noite em São Paulo.
2. Crie `deploy/.env` contendo `VISIORA_HOST=seu-dominio.example` (somente o nome do host, sem protocolo). Certifique-se de que DNS e 80/443 apontem para o servidor.
3. Gere um hash bcrypt de senha forte executando `docker run --rm -it caddy:2.11.7-alpine caddy hash-password`. Copie `deploy/auth.caddy.example` para `deploy/auth.caddy` e substitua `SUBSTITUA_PELO_HASH_BCRYPT` pelo hash. **Não use** a senha ou hash de exemplo; o arquivo real é ignorado pelo Git.
4. Execute `docker compose --env-file deploy/.env -f deploy/compose.yml config` para revisar o manifesto, depois `docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build`.
5. Abra `https://seu-dominio.example` no notebook/celular e autentique-se no diálogo do navegador. Escolha Luna, dê consentimento e confira câmera/voz.

`gateway` e `https` compartilham apenas a namespace de rede do Docker: Node continua ouvindo `127.0.0.1:8080` dentro dessa namespace e **nenhuma porta HTTP direta é publicada**. Caddy publica 80/443, autentica todas as rotas e encaminha o Host interno fixo. A variável `VISIORA_PUBLIC_ORIGIN` permite somente a origem HTTPS exata; POST continua exigindo `Origin`, CSRF e consentimento. O arquivo SQLite fica no volume `luna_ledger`, não na imagem nem no Git.

## Verificação e limites

- Com credencial inválida, a página e `/api/vision/status` devem retornar HTTP 401. Com credencial válida, o status deve retornar `ready=true` antes de ativar a câmera.
- Testar duas tentativas simultâneas e confirmar que só uma reserva de pagamento é autorizada. Verificar que gastos/reservas persistem após reiniciar o contêiner.
- Simular autorização ausente, `Origin` externo e CSRF incorreto: nenhum deles deve chamar a OpenAI. Conferir o teto US$ 10 em 23/10 e US$ 2 em 24/10.
- Não foram realizados deploy, teste de Docker/HTTPS, câmera/voz físicas nem chamada paga nesta preparação. A CI cobre apenas código e simulações. Não anunciar uso seguro, acessibilidade validada ou confiabilidade de rede na apresentação.
- **O endereço Site atual permanece sem Luna** até que seu mecanismo de hospedagem receba um gateway equivalente; esta implantação usa um endereço HTTPS separado.

Não publique a máquina sem confirmar autenticação, TLS, host e orçamento; suspenda o gateway se a autenticação ou persistência falhar.
