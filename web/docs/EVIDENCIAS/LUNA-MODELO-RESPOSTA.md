# Conferência e registro do modelo da resposta

Data: 18/10/2026. Alteração local, não publicada. Escopo autorizado: conferir e registrar `model` devolvido pela API. Nenhuma chamada externa ou paga executada nesta mudança; `.env` e limites autorizados preservados.

## Resultado executado

| Verificação | Resultado | Critérios relacionados |
| --- | --- | --- |
| `npm test`, com build | 96 testes passaram, zero falhas | CA-E1 (parcela local), CA-L1/L2/L3 |
| `npm run test:luna`, depois dos ajustes finais | 23 testes passaram, zero falhas, incluindo cinco testes novos com matrizes de cenários | CA-L1/L2/L3 |
| `npm run typecheck` | Passou; TypeScript estrito do cliente/cérebro, não do gateway ESM | CA-E1 (parcela local) |
| `npm run lint` | Passou; sintaxe e regras do projeto | CA-E1 (parcela local) |
| Simulador comparado com `luna-local/transcricoes-locais.jsonl` | Seis transcrições idênticas por comparação JSON | CA-F2/F3/F4/F7/F8/P6, sem mudança de fala normal |

Saídas completas dos testes: [regressão](luna-model-regression.txt) e [integração Luna](luna-model-tests.txt). Esses resultados não representam CI remoto, qualidade do modelo ou audição real.

## Casos novos

- `model` exato `gpt-6-luna` é aceito; nomes de outros modelos ou sufixos não documentados são rejeitados. Nome solicitado não substitui o campo devolvido. Texto gerado não determina o modelo.
- Ausência, null, tipo incorreto, ID vazio/grande, quebra de linha e valor com prefixo de chave são bloqueados. Valor inválido não é registrado como texto bruto.
- Gateway HTTP real em loopback com upstream simulado: análise aceita somente no caso confirmado. Divergência/ausência/inválido retornam 502 sem evidência, conservam reserva integral de US$ 0,30 e não repetem requisição.
- SQLite e evento JSON registram modelo solicitado/informado e verificação antes de entregar a análise. Respostas incompletas, recusas, erros HTTP e JSON malformado também registram metadados disponíveis. Sem resposta de rede não existe confirmação. Fake não gera prova de modelo real.
- Falha de gravação bloqueia entrega. Migração de ledger antigo acrescenta tabela sem mexer nos gastos, sem liberar pedido pendente e sem preencher modelos retroativamente. Registro novo persiste após reabrir o banco.
- `npm run luna:models` foi executado como subprocesso sobre ledger de teste antigo/atualizado: informa ausência de conferência antiga e depois exibe modelo, verificação e estado da análise. Abertura somente leitura, sem chave nem API.

## Como conferir na próxima consulta real

Pare o gateway antigo com Ctrl+C e execute `npm run dev:luna` na pasta `visiora`. Recarregue a página. No próximo pedido explícito com consentimento, procure `visiora_model_response` no terminal; `requestedModel`, `returnedModel` e `verification` são os dados relevantes. Em outro terminal, `npm run luna:models` consulta os últimos vinte registros. `verified` confirma o metadado da API, e `analysisState` distingue uma análise concluída de uma falha/recusa. IDs novos de modelo exigem revisão da política; nenhum prefixo é aceito automaticamente.

## Não testado / limites

Não executada uma resposta real após esta alteração; não confirmar retroativamente o modelo das seis consultas anteriores. Sem inspeção dos pesos/infraestrutura do provedor: a prova é o identificador declarado no envelope HTTPS da API. Não medidos qualidade/latência/fatura, precisão de caixas, retenção real, câmera/voz física ou usuários cegos nesta alteração. Não repetidos E2E de navegador porque contrato de sucesso, captura e narração não mudaram; erro de modelo foi testado no gateway e a mensagem do cliente passou no build/tipos. SQLite permanece experimental no Node 24, e o gateway ainda é JavaScript ESM conforme ADR-017. As reservas preservadas não são garantia da cobrança externa em caso de divergência do provedor.
