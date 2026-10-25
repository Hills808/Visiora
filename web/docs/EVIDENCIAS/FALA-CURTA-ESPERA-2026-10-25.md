# Fala curta e medição da espera — ADR-049 (25/10/2026)

Critérios: CA-F3/F4/F6/F7/L4 e instrumentação CA-D1/D3/S4. A sessão recebida em 24/10 mostrou inícios de fala entre 4,8–6,5 s e durações de 8,5–16,8 s por callbacks. Não é possível concluir a causa de uma expiração específica sem tempos de espera separados. Esta fatia reduz o limite de palavras e torna esses tempos observáveis; não mede ganho de latência da API real.

## Mudanças

A preferência existente Quantidade de informação agora chega ao Luna, tanto no automático quanto nas respostas manuais. Antes, afetava o cérebro local e não o cliente de capturas. Sem criar mais controles:

| Perfil | Descrição inicial, palavras máximas | Atualização, palavras máximas | Grupos máximos |
|---|---:|---:|---:|
| Só o essencial | 25 | 25 | 1 |
| Equilibrado (padrão) | 32 | 25 | 3 |
| Mais referências | 45 | 25 | 3 |

Os limites incluem fonte, idade e direção. Cada grupo é uma referência/quantidade por setor; pode representar várias pessoas, não é limite de indivíduos físicos. No perfil essencial, referências certas e mais centrais precedem as outras; empate preserva a ordem do provedor. Isso é seleção de foco relativo à câmera, não uma classificação de risco ou qualidade de navegação. Outros perfis conservam a ordem anterior entre referências de mesma certeza.

Selecionar somente grupos completos: não cortar rótulo, retirar incerteza, inventar distância ou mudar frases de setor. Itens que não cabem não são confirmados como falados; repetição explícita mantém o conteúdo que realmente concluiu e informa a idade atual. A memória contra repetição da ADR-048 permanece. A validade de posições continua em dez segundos. Diminuir palavras pode deixar referências úteis para uma consulta posterior; não se anuncia tudo automaticamente numa vista parada.

Novos campos numéricos do diagnóstico: responseToPreparation mede da resposta aceita à preparação da fala; responseToStart mede da resposta aceita ao callback de início. preparationToStart continua separado. São amostras limitadas e agregadas por canal e percepção real/simulada; não guardam imagem, rótulo ou transcrição. Repetir não gera amostras novas de latência de análise. Cancelar/reiniciar a sessão retira o relógio associado à resposta anterior.

Modelo, esquema, prompt, dimensões de captura, agenda de envios, consentimento, chave, teto e ledger não mudam. Não há chamada adicional para completar automaticamente os itens omitidos nem dependência/modelo novo. Alternativas de aumentar validade, acelerar voz arbitrariamente, remover a idade da captura ou cortar strings foram rejeitadas por comprometer compreensão e atualidade.

## Evidências executadas

- npm test: 253/253, incluindo perfis manual/automático, prioridade essencial, palavras/setores completos, nomes longos, itens não entregues, preferência e replay; testes de tempo separam 5 s de análise, 1,6 s de espera e 50 ms de início, sem confundi-los.
- npm run typecheck e npm run lint passaram. Simuladores local e memória executados; transcrições anexas.
- node tests/e2e/luna-verbosity.mjs: quatro cenários com câmera artificial, API fake, HTTP real em loopback e voz controlada. Interface→preferência→captura→fala: 20/29/38 palavras para essencial/equilibrado/detalhado na mesma cena; quatro chamadas fake. Um diálogo real de ajustes reteve a resposta; espera separada registrada, sem expiração ou envio adicional. Resultado em FALA-CURTA-E2E-2026-10-25.json. Contagem de palavras não mede duração acústica.
- Regressão de repetição: seis cenários, 61 análises em cinco minutos simulados e zero repetição de objetos depois do briefing; novidade, Repeat e nova vista preservados.
- Regressão de movimento: treze cenários e dezessete chamadas fake; nenhum ensaio físico de caminhada.

Sol escreveu o arquivo isolado de testes de perfis; coordenador implementou, revisou o diferencial e executou e integrou os testes. Sem revisão final Astra nesta fatia.

## Não testado e próximo passo

Não foram medidos ganho real de latência da OpenAI, duração de áudio audível, preferência/compreensão por pessoas cegas, câmera/voz/giroscópio físicos, iPhone/Android, VoiceOver/TalkBack, precisão ou utilidade caminhando. Não declarar CA-D1/D3 atendidos apenas por instrumentação; CA-A4/A5 seguem pendentes. A percepção local contínua continua experimental, opcional e sem fala/gatilhos pagos. Próxima etapa: reteste da cena/voz com diagnóstico adr-049 para separar tempo da análise, espera e duração; benchmark temporal anotado e avaliação humana antes de liberar fala híbrida.
