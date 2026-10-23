## Exceção para apresentação — 23/10/2026 (ADR-037)

Por autorização do usuário, o teto de reserva do **Luna** no piloto com servidor configurado foi elevado para **US$ 10 no dia 23/10/2026**, no fuso `America/Sao_Paulo`. Esse valor inclui as reservas e os gastos já computados no dia: não é crédito adicional. Às 00h de **24/10/2026**, retorna automaticamente ao teto normal de **US$ 2/dia**, mesmo sem reiniciar o processo. A configuração `VISIORA_DAILY_USD` continua limitada a 2; a exceção só atua com o Luna previamente habilitado e orçamento normal positivo. Histórico, reservas incertas, chave e consentimento permanecem intactos. Para usar o código novo, atualizar o checkout local e **reiniciar o gateway** antes da apresentação. Isso não altera cotas ou faturamento do provedor e não resolve timeout, rede, credenciais ou falhas de voz. O link público estático ainda não oferece Luna. Evidência e roteiro: [EVIDENCIAS/LUNA-LIMITE-APRESENTACAO-2026-10-23.md](EVIDENCIAS/LUNA-LIMITE-APRESENTACAO-2026-10-23.md).

## Orçamento corrigido: US$ 2 por dia — ADR-025 (19/10/2026)

O limite autorizado é **US$ 2 por dia**, renovado à meia-noite de São Paulo (`America/Sao_Paulo`). Não há teto acumulado de US$ 2. `VISIORA_DAILY_USD=2` continua válido; `VISIORA_TOTAL_USD` foi aposentado e é ignorado, mesmo se ainda existir no `.env`. Configuração inicial continua zero/desligada; valor diário acima de 2 é recusado. Nenhum segredo precisa ser reenviado ou editado para aplicar esta correção.

Pare o gateway no terminal com Ctrl+C, execute `npm run dev:luna` novamente, recarregue a página e inicie a ambientação com consentimento. Só recarregar o navegador não atualiza o código do servidor. Não apague o SQLite: o histórico e as reservas incertas são preservados e atribuídos ao dia de início pelo timestamp original, inclusive registros antigos com coluna `day` em UTC. Uma solicitação pendente continua bloqueando outra chamada mesmo após a meia-noite. [Evidência](EVIDENCIAS/LUNA-ORCAMENTO-DIARIO.md). As notas abaixo sobre teto total/dia UTC são históricas e sucedidas por esta seção.

## Continuidade revisada no piloto local (18/10/2026)

ADR-021 sucede os parâmetros do primeiro automático: intervalo mínimo de 4,5 s, gatilho por blocos para mudanças localizadas, orientação após mudança ampla de vista e aviso qualificado quando uma pessoa deixa de ser identificada, mesmo com móveis iguais. Respostas cuja imagem mudou durante a consulta são descartadas. Uma falha temporária conhecida permite uma nova captura após pelo menos 15 s; segunda falha consecutiva pausa. Erros de orçamento, credencial, consentimento, modelo ou contrato pausam sem recuperação. Consentimento `cloud-v3-continuity`. Preservados US$ 2/dia, US$ 2 totais, reserva e histórico. Nenhuma chamada paga feita pelo agente para testar esta mudança. Guia: [ACOMPANHAMENTO-AUTOMATICO.md](ACOMPANHAMENTO-AUTOMATICO.md); evidência: [LUNA-CONTINUIDADE.md](EVIDENCIAS/LUNA-CONTINUIDADE.md). Publicado continua 0.3; os blocos anteriores abaixo são históricos.

## Atualização: análise automática autorizada (18/10/2026)

O fluxo principal passou a analisar ao ativar e após mudanças relevantes, sem perguntas obrigatórias. Leia `ACOMPANHAMENTO-AUTOMATICO.md` para atualizar/reiniciar e marcar a nova autorização `cloud-v2-auto`. O consentimento antigo não autoriza envios ao gateway atualizado. Tetos de US$ 2 diários/totais, chave e ledger existentes foram preservados. Nenhuma chamada paga nova para estes testes. O guia anterior abaixo descreve configuração e histórico da etapa sob demanda; reservas, segredo e conferência do modelo continuam aplicáveis, mas análises podem agora ocorrer automaticamente dentro dos limites e da autorização.

# Configurar o Luna no Visiora

> Atualização de 18/10/2026: o piloto local recebeu teto autorizado de US$ 2 por dia e US$ 2 no total. A chave foi colocada pelo usuário no `.env` ignorado pelo Git. A tarifa Standard foi conferida por limite superior de tokens e a configuração local habilitada, conforme ADR-018. Ainda não houve chamada à API nem envio de imagem; o site publicado continua em 0.3. O usuário precisa abrir o servidor local, consentir no aplicativo e solicitar uma análise para que haja cobrança. A disponibilidade da chave/modelo e a fatura real continuam sem teste.

## O que já existe

A integração local está implementada: câmera → JPEG inteiro → servidor → Responses API com `gpt-6-luna` → validação → descrição curta/voz local. O modo Luna é a opção principal da interface. Ainda não foi executado com uma chave real. O site publicado continua na versão 0.3, sem essa integração.

O primeiro incremento funciona **por pedido**, não analisa automaticamente a câmera. Descrever, reconhecer lugar e procurar item fazem uma consulta. Repetir usa memória local, sem outra consulta. O modo local anterior continua disponível no seletor. Não é um sistema de navegação segura.

## O que você precisa preparar

1. Acesse a [Plataforma OpenAI](https://platform.openai.com/), escolha/crie um projeto separado para Visiora e confira acesso ao modelo e faturamento. A API é cobrada separadamente da assinatura ChatGPT; créditos deste chat não são créditos da API.
2. Configure o teto diário em dólares, com ponto decimal. O usuário autorizou US$ 2 por dia; não há teto acumulado do piloto. O controle local não substitui a conferência da cobrança no provedor. Não ative recarga automática sem querer.
3. Para configurar uma chave no Sites, ative o plugin [OpenAI Developers](plugin://openai-developers@openai-curated-remote). O fluxo oficial da skill `openai-platform-api-key` cria/configura a chave com a aprovação exigida. O plugin não estava disponível para executar essa etapa nesta entrega.
4. Autorize o envio das imagens no aplicativo somente quando quiser usar a API real. Não é uma autorização para guardar fotos de pesquisa ou reaproveitar anexos privados desta conversa.

**Não cole a chave no chat e não envie `.env`, captura da chave ou arquivo de credenciais.** Ela fica no servidor. No ambiente hospedado usaremos o segredo nativo, não um campo na página. A chave deve ter permissões mínimas para as chamadas necessárias; nunca usar uma chave de administração da organização no aplicativo.

## Rodar e testar sem chave e sem cobrança

Na subpasta `visiora`, com Node 24 e dependências do projeto disponíveis:

```powershell
npm run build
$env:VISIORA_PROVIDER = "fake"
npm run dev:luna
```

Abra `http://127.0.0.1:8080`. O aplicativo identifica explicitamente o simulador. A resposta padrão do backend fake é vazia; não finge reconhecer a foto. Os exemplos positivos estão nos testes, onde os dados artificiais são explícitos. Encerrar o processo para parar. Em um novo terminal, o padrão volta a Luna desativado.

## Configuração local real — somente após orçamento e revisão

O arquivo `.env.example` contém apenas nomes e valores desativados. Quem controla a máquina pode copiá-lo para `.env` e preencher a chave diretamente no editor local, sem exibi-la nesta conversa. A chave não deve ser prefixada como variável pública nem copiada para `public/`, `src/`, manifesto, logs ou Git. O `.env` e a pasta `.runtime/` estão ignorados pelo Git.

| Variável no servidor | Significado |
|---|---|
| `OPENAI_API_KEY` | Segredo do projeto; nunca vai para o navegador |
| `VISIORA_PROVIDER` | `luna` para API; `fake` para simulação explícita |
| `VISIORA_LUNA_ENABLED` | Começa em `0`; somente `1` habilita o caminho real |
| `VISIORA_DAILY_USD` | Teto diário conservador, USD, ponto decimal; começa em `0` |
| `VISIORA_TOTAL_USD` | Aposentada na ADR-025; ignorada mesmo em `.env` antigo |
| `VISIORA_PRICING_CONFIRMED` | Deixar vazio até conferir a revisão de tarifas/reserva; revisão implementada `2026-10-18` |
| `PORT` | Porta local, padrão `8080` |

Não preencha a confirmação de preços por tentativa e erro. Antes da primeira chamada, verificar faturamento de imagem para Luna, tarifas, modalidade Standard e ausência de taxas não contempladas. O programa usa `service_tier: default`, sem ferramentas, arquivos remotos, contexto longo acumulado ou tentativas automáticas. A disponibilidade real desses parâmetros ainda depende do smoke de API.

Após configuração revisada, execute `npm run dev:luna` em um terminal sem `VISIORA_PROVIDER=fake` herdado. O Node carrega `.env`; variáveis já presentes no terminal têm precedência. Esse comando inicia o servidor, não faz uma chamada paga sozinho. Uma consulta com câmera e consentimento ativo é que pode gerar cobrança.

## Como o limite funciona

### Conferir o modelo que respondeu

Após atualizar o código, pare o servidor com Ctrl+C e inicie novamente com `npm run dev:luna`. No próximo pedido explícito com consentimento, o terminal mostrará um evento como `{"event":"visiora_model_response","requestId":"...","requestedModel":"gpt-6-luna","returnedModel":"gpt-6-luna","verification":"verified"}`. Esse exemplo ilustra o formato; não é uma resposta real capturada nesta mudança. Em outro terminal da pasta `visiora`, execute `npm run luna:models` para ler os registros persistidos, sem gastar API. `verified` confirma o campo devolvido pela API; consulte também `analysisState` para saber se a consulta concluiu. Modelo faltando/inválido/diferente bloqueia a descrição e mantém a reserva inteira. Consultas antigas continuam sem esse metadado. Não faça outra consulta apenas para testar a voz: Repetir usa a descrição local.

### Reserva e contabilidade

O servidor reserva **US$ 0,30 por chamada em andamento**, antes de despachar. Isso é uma reserva conservadora baseada no contexto máximo e tarifas consultadas, **não o preço esperado de uma foto**. Portanto, um teto inferior a essa reserva bloqueia a consulta. Depois de uma resposta concluída com uso válido, registra uma estimativa superior conservadora pelos tokens e libera a diferença. Sem uso válido ou após falha incerta, mantém a reserva inteira.

As reservas ficam em SQLite local, `.runtime/luna-budget.sqlite`, sem imagens ou descrições. Uma chamada simultânea por arquivo de orçamento, até 15 por minuto e intervalo mínimo de 4 segundos no gateway (4,5 s no automático). Pedidos repetidos com o mesmo ID não são reenviados. O dia usa São Paulo e renova à meia-noite, sem apagar o histórico. Usar o mesmo arquivo de orçamento, sem copiar servidores para duplicar o teto.

Se o processo cair com um pedido pendente, novos despachos ficam bloqueados até revisar o consumo e reconciliar o registro. Não apague o banco para destravar: isso apaga a memória do gasto. A reconciliação administrativa ainda não tem interface. Erros de preço, banco ou configuração não devem ser resolvidos aumentando limites às cegas. A estimativa do aplicativo não é a fatura oficial; acompanhe também o consumo na plataforma. Os limites da plataforma podem ser alertas, não um corte imediato.

Para interromper novos gastos: pare o servidor; desative `VISIORA_LUNA_ENABLED` antes de reiniciar. Desmarcar o consentimento também encerra a sessão no navegador. Cancelar não desfaz uma solicitação já recebida pelo provedor, nem garante ausência de cobrança.

## Imagens e limitações

Sem fotos em disco ou logs implementados. A imagem é transmitida em memória; `store:false` reduz armazenamento de estado da Responses API, **não garante retenção zero no provedor**. Os controles e exceções de monitoramento/retenção precisam ser conhecidos antes de usar imagens privadas. Apagar dados do navegador não apaga dados do provedor e não apaga o registro de orçamento do servidor.

Toda fala Luna deste incremento descreve uma captura com idade explícita. Não entra no World ou Scene atual. Respostas recebidas acima de dez segundos são descartadas. Movimento visual, parada e troca de sessão invalidam resultados pendentes; o detector de mudança não mede giro físico nem garante que a cena permaneceu igual. Caixas/direções e contagens do modelo são estimativas ainda sem benchmark. Sem caixa, não inventamos direção; nunca usamos distância do Luna. Não há análise paga automática ou identificação facial.

Ainda não testados: API real, permissões da chave, custos faturados, precisão de ambientes/objetos/pessoas, qualidade de caixas, latência de rede/API, webcam física, voz audível, smartphone físico, leitores de tela e usuários cegos. Testes com respostas artificiais provam lógica e integração, não reconhecimento real.

## Fontes oficiais consultadas em 18/10/2026

- [Modelo Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Visão e imagens](https://developers.openai.com/api/docs/guides/images-vision)
- [Retenção e controles de dados](https://developers.openai.com/api/docs/guides/your-data)
- [Chaves de API](https://help.openai.com/en/articles/4936850-how-to-set-up-your-chatgpt-account)
- [Proteção da chave](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
- [Cobrança separada](https://help.openai.com/pt-br/articles/9039756-configura%C3%A7%C3%B5es-de-faturamento-no-chatgpt-vs-plataforma)
