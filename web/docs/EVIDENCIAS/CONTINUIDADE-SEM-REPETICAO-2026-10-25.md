# Continuidade sem repetição — ADR-048 (25/10/2026)

Critérios: CA-F1/F4/F6/F7/F9/L4. Correção iniciada em 24/10 e concluída em 25/10 no fuso America/Sao_Paulo. O usuário relatou narração repetida em cena parada. O diagnóstico anterior confirma entregas, mas não contém transcrição: não determina a causa exata de cada repetição real.

## Causas reproduzidas e mudança

- Antes, uma hipótese de lugar confirmada disparava orientação e limpava a memória do que já fora dito. Agora corrige só o contexto, preservando objetos entregues. Há no máximo uma correção automática do nome por vista; nova vista ou pergunta explícita continua disponível.
- Uma omissão isolada antes removia a referência narrada, fazendo sua reaparição parecer novidade. Agora a não identificação automática exige três capturas distintas na mesma vista e pelo menos nove segundos desde a primeira omissão. A lembrança linguística expira silenciosamente após 30 segundos sem observação; não é posição atual.
- Uma pessoa identificada com box:null é presença sem localização. Não gera aviso de ausência nem reutiliza uma direção antiga. Resolve a pendência narrativa separada registrada na ADR-047.
- Pequenas oscilações de contagem para baixo não apagam a quantidade já narrada; aumentos continuam elegíveis. Mistura de certeza dentro da mesma quantidade/setor não divide o grupo em duas narrações. Um grupo misto é tratado como incerto, sem promover hipótese a certeza.
- Refinamentos equivalentes são limitados às três famílias explícitas de CONFIG.online (cadeira, janela, armário). Exigem sobreposição de caixas >=0,70 e correspondência única um-para-um, priorizando rótulo exato. Não há redução livre à primeira palavra: cadeira de rodas, rótulos desconhecidos, posição diferente e objetos simultâneos continuam distintos. Isso é equivalência linguística conservadora, não identidade/tracking.

Entrega só é confirmada ao concluir a fala válida. Interrupção/expiração não confirma novidade nem correção de lugar. Nova vista/invalidação ainda retira posições e permite orientação recente; A→B→A não restaura captura antiga. Snapshot máximo de dez segundos, frequência de chamadas, modelo, chave, ledger, orçamento e consentimento não foram alterados. Sem nova dependência ou API paga para testes.

## Evidência executada

- npm test: 235/235 passaram; npm run typecheck e npm run lint passaram.
- Simuladores local e memória executados. Transcrições atualizadas em CONTINUIDADE-TRANSCRICOES-2026-10-25.jsonl; o registro histórico de movimento de 24/10 permanece intacto. Mudanças esperadas: ausência pontual fica silenciosa e troca do lugar não repete objeto; cenas adicionais cobrem omissão, caixa ausente e rótulo qualificado.
- E2E de repetição: teste de câmera artificial, HTTP real em loopback, provedor/voz substituídos e relógio simulado; sem OpenAI. Executar node tests/e2e/luna-repetition.mjs. O resultado versionado acompanha este relatório.
- Regressão de movimento: node tests/e2e/luna-movement.mjs; entradas, API e voz artificiais. Não é ensaio de caminhada.

## Orquestração e limites

Sol criou o novo teste E2E; o coordenador corrigiu sua codificação UTF-8, executou, integrou a memória e revisou o diferencial. Astra reproduziu quatro fontes de repetição e recomendou separar lugar, presença e direção; sua segunda revisão final não concluiu por indisponibilidade da sessão. Não se declara revisão final independente concluída.

Não testado: nova sessão paga com cena do usuário, voz audível, câmera/giroscópio físicos, cinco minutos reais de cena, iPhone/Android, leitores de tela, qualidade/precisão de detecção ou utilidade com pessoas cegas. CA-F1 tem evidência simulada parcial; CA-A4/A5 permanecem pendentes. Os limiares de três capturas/nove segundos e as equivalências são hipóteses a avaliar; podem atrasar avisos verdadeiros de não identificação. Variações fora da lista e invalidações amplas ainda podem produzir novas narrações. Memória de quantidade não mede saída/entrada nem identidade de pessoas; não é alerta de aproximação. Não anunciar navegação segura.

Resultado final do E2E: 323918 ms simulados; 61 análises na vista, duas falas (briefing + correção de lugar), zero repetição de objetos. Seis cenários passaram, 64 chamadas ao fake, zero erro de página e zero destino fora de loopback. Regressão de movimento passou em 13 cenários com 17 chamadas fake.
