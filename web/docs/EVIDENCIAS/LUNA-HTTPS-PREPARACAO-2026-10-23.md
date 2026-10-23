# Preparação do gateway Luna para HTTPS (23/10/2026)

**Estado: experimental, não publicar nem expor na internet.** Critérios CA-L2, CA-L3, CA-E4.

O gateway continua ouvindo somente 127.0.0.1 e exige Host local. Uma futura camada de autenticação deverá validar cada usuário antes de encaminhar requisições, inclusive status e análise. O proxy TLS precisará manter Host upstream como `127.0.0.1:PORT` e estabelecer a variável `VISIORA_PUBLIC_ORIGIN` com a origem HTTPS exata (sem barra final). Essa variável altera apenas a comparação do cabeçalho Origin; não autentica usuários.

**Bloqueios para o deploy:** implementar autenticação server-side e autorização nas duas rotas, proteção contra uso anônimo do orçamento, armazenamento transacional único do ledger persistente, política de sessão e configuração de segredo na hospedagem; depois ensaiar 401/403, CSRF, ataques de origem, solicitações concorrentes, reinício e orçamento antes de habilitar API paga. O token CSRF público atual pode ser obtido por qualquer visitante e **não é autenticação**.

O limite existente de US$ 2/dia em America/Sao_Paulo, a chave exclusivamente em servidor, consentimento explícito e o retorno ao modo local devem continuar. Nunca copiar `.env` ou `.runtime` para publicação.

**O que esta fatia altera:** parametrização opcional e estrita de origem HTTPS com o gateway ainda preso ao loopback; teste de origem e token CSRF acrescentado. Testes locais, navegador, webcam, gasto real e revisão de infraestrutura hospedada **não foram executados neste ambiente**. A CI do PR é o próximo controle técnico.

A versão Site estática atual continua válida para demonstração **local** no navegador; Luna remoto não está disponível nela.
