# CA-L3 — Exceção de US$ 10 em 23/10/2026

Autorização: usuário pediu US$ 10 somente no dia de sua apresentação em sala de aula. ADR-037.

- Configuração padrão segue desligada; `VISIORA_DAILY_USD` continua com máximo de 2 e não se publica segredo.
- Quando o gateway já está habilitado, a função de reserva usa US$ 10 no calendário de São Paulo em 23/10/2026. São US$ 10 para o dia inteiro, incluindo consumo e reservas anteriores.
- Sem intervenção manual, às 00h de 24/10 retorna a US$ 2/dia; a apuração consulta `at`, não uma etiqueta antiga de data. O SQLite persiste e pedidos incertos seguem contabilizados.
- Teste automatizado acrescentado em `tests/luna-budget.test.mjs`: 33 reservas artificiais (US$ 9,90), tentativa excedente negada, data ainda 23 às 02:59:59Z, nova data 24 às 03:00:01Z, seis reservas regulares e sétima negada. Testa também que base zero deixa o modo real desligado.

**Executar:** dentro de `web/`, `node --test tests/luna-budget.test.mjs`; depois `npm test`, `npm run typecheck`, `npm run lint` e `node tools/simulate.mjs`. O runner de CI do PR fornece evidência executada; até lá esses resultados são expectativa, não teste concluído.

**Para aplicar hoje:** atualizar o código do servidor local antes do teste, confirmar que o `.env` privado já configura Luna com `VISIORA_DAILY_USD=2`, executar `npm run dev:luna` novamente e fazer uma solicitação consentida. Não limpar `.runtime`. Sem acesso à sessão Windows, o servidor real e seu limite efetivo não foram conferidos; também não foram testados saldo/fatura da OpenAI, falhas reais, câmera/voz na sala de aula, notebook, celular, nem caminho HTTPS público (continua pendente).
