# Evidência — orquestrador textual separado (22/10/2026)

Escopo: `tools/ai-orchestrator/` e `tests/ai-orchestrator.test.mjs`. Critérios relacionados: CA-E1 (verificações), CA-E4 (nenhum segredo/dependência paga no aplicativo) e CA-S3 (teste fake sem rede). Nenhum critério de percepção, fala ou aceite humano é reivindicado.

| Execução | Resultado |
| --- | --- |
| `node --test tests/ai-orchestrator.test.mjs` | 6 testes, 6 passaram |
| `node --test (Get-ChildItem -LiteralPath tests -Filter '*.test.mjs' \| ForEach-Object FullName)` em PowerShell | 156 testes, 156 passaram |
| `node tools/check.mjs` | Sintaxe e regras locais passaram |
| `node node_modules/typescript/bin/tsc --noEmit` | Código de produto com tipos sem erro |
| Prettier `--check tools/ai-orchestrator tests/ai-orchestrator.test.mjs` | Formatação passou |
| `node tools/simulate.mjs` | Seis cenas produziram transcrições; não foi detectada falha no comando |
| `node tools/ai-orchestrator/cli.mjs preview "Criar API e testes"` | Prévia local JSON, sem chave ou rede; reserva ilustrativa de US$ 0,020084 para uma chamada Sol |

`npm test`/`node tools/build.mjs` pararam com código 1 **antes de rodar a suíte**: `tools/build.mjs` chama `python tools/package_local.py`, mas `python` não existe no ambiente e `py --version` informou “No installed Python found!”. O build havia criado `dist`; a suíte foi executada diretamente sobre esse build e passou. Não foi alterado o empacotador do Visiora para contornar o ambiente.

Casos do fake: plano inválido é rejeitado; tarefa simples evita revisão; implementação moderada usa Sol; arquitetura crítica usa Astra; múltiplas tarefas acionam revisor; orçamento insuficiente interrompe antes da chamada; revisão reprovada não tenta de novo; uso de tokens ausente e identificador de modelo divergente falham fechados. A CLI com chave fake presente recusa `run` sem `--allow-paid-api` antes de criar o provedor.

**Incidente de diagnóstico:** antes do sinalizador adicional, uma invocação de `run` com orçamento de teste encontrou uma chave já presente no ambiente e retornou `fetch failed`. Não houve resposta nem uso observado; não é prova de que a requisição não alcançou a API ou de cobrança zero. A proteção foi adicionada e testada sem rede. Não houve outra invocação real nesta entrega.

**Não testado:** resposta bem-sucedida da Responses API, disponibilidade dos modelos na conta, preço/fatura e limite externo, qualidade das respostas, ganho econômico, latência, recuperação após queda, concorrência, edição de repositório, ferramentas, sandbox, worktrees, testes E2E de navegador e uso por terceiros.
