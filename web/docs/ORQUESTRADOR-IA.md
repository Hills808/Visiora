# Orquestrador de IA para desenvolvimento — primeira fatia

Ferramenta de linha de comando em `tools/ai-orchestrator/`, separada do aplicativo Visiora. Ela recebe um pedido textual, pede ao Luna um plano de até quatro tarefas, escolhe um modelo para cada tarefa e, quando há risco moderado/alto ou várias tarefas, solicita revisão. Os agentes produzem **texto**; não recebem acesso a arquivos, terminal, navegador ou publicação. Nenhum projeto é editado automaticamente nesta fatia.

```
pedido → planejador Luna → validação do plano → tarefas sequenciais → revisão condicional → resultado + uso
                                      ↘ roteador Luna / Sol / Astra ↗
```

## Uso

Requer Node 24 ou superior. `preview` é local e gratuito; mostra somente uma reserva ilustrativa para uma implementação média, sem classificar de verdade:

```powershell
node tools/ai-orchestrator/cli.mjs preview "Criar uma API de cadastro"
```

`run` usa a Responses API e pode gerar cobrança. Exige `OPENAI_API_KEY` no ambiente, orçamento explícito para **esta execução** e `--allow-paid-api`. Não lê `.env`, banco nem teto de US$ 2/dia do gateway Visiora. Se a chave do ambiente for a mesma do gateway, a cobrança pode aparecer na mesma conta: o orçamento local desta ferramenta não é compartilhado com o Visiora. Não houve resposta da API real nesta entrega.

```powershell
node tools/ai-orchestrator/cli.mjs run --allow-paid-api --budget-usd 0.50 "Planeje uma API e seus testes"
```

O resultado JSON informa tarefas, modelo, motivo de escolha, revisão, tokens e custo **estimado** conforme a resposta da API. `approved:false` requer revisão humana; o programa não repete nem eleva a chamada por conta própria. Toda execução é sequencial para evitar gasto concorrente e conflitos entre resultados.

## Política inicial

| Caso | Modelo | Revisão |
| --- | --- | --- |
| Tarefa curta, teste ou documentação delimitada | GPT-6 Luna | Só se houver mais tarefas ou risco médio |
| Implementação, complexidade alta ou risco alto não arquitetural | GPT-6.1 Sol | Sol ou Astra conforme risco |
| Arquitetura complexa ou auditoria crítica | GPT-6 Astra | Astra |

A política é regra de partida, não medição de qualidade. Ela precisa ser calibrada em tarefas reais com avaliação cega de correção, tempo, tokens, custo de retrabalho e regressões. Para uma tarefa curta, uma única chamada pode ser mais barata que planejamento + execução; a próxima versão deve ter caminho direto sem planejador após essa medição.

Preços Standard de texto por milhão de tokens consultados em 22/10/2026: Luna US$ 0,10/0,50, Sol US$ 2/10, Astra US$ 10/50 (entrada/saída). Exemplo **hipotético** com 100 tarefas de 5 mil tokens de entrada e mil de saída cada, sem cache nem overhead: todas com Sol custariam US$ 2,00; 80 Luna, 18 Sol e 2 Astra custariam US$ 0,64, economia bruta de 68%. Planejamento, revisão e retrabalho reduzem essa economia. Não é benchmark observado. [Tabela oficial](https://developers.openai.com/api/docs/pricing).

## Limites e próximos passos

- A reserva por etapa usa bytes UTF-8 como teto conservador de entrada, folga de protocolo e teto de saída; o custo final usa `usage`. Não é garantia de fatura: taxas, mudanças de preço, erro após envio e cobranças fora deste processo podem diferir. Configure também limite real no projeto da API. Uma resposta sem uso ou com modelo divergente falha fechada.
- `store:false` reduz armazenamento de respostas na API, mas não promete retenção zero do provedor. Não envie segredos, fotos privadas nem material sensível sem política própria.
- Não há persistência entre processos, retomada após queda, chamadas paralelas, cache, edição de código, sandbox, worktrees, execução de testes nem avaliação de qualidade real. O orçamento é por execução e não é um teto compartilhado entre máquinas.
- Para atuar em repositórios: integrar um executor com ferramentas restritas, checkout isolado por tarefa, diffs revisáveis, testes verificáveis e aprovação antes de merge/publicação. Separar decisões de modelo da execução de ferramentas. Só paralelizar tarefas independentes em árvores isoladas.
- A Responses API multiagente nativa ainda usa o mesmo modelo para raiz e subagentes numa requisição; por isso o roteamento entre Luna/Sol/Astra vive nesta aplicação. [Documentação oficial](https://developers.openai.com/api/docs/guides/responses-multi-agent).

## Evidência

`node --test tests/ai-orchestrator.test.mjs` cobre a política, limites do plano, fluxo com provedor fake, orçamento e resposta com modelo divergente. Isso atende apenas à verificação de engenharia CA-E1 desta ferramenta e ao isolamento sem segredo/cobrança em testes (CA-E4/CA-S3). Não demonstra a qualidade dos modelos, economia real nem validação de acessibilidade do Visiora.
