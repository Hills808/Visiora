# Plano detalhado da Fase 1 — cérebro e simulador

Data: 17/10/2026. **Proposta para aprovação; não iniciada.** Prazo indicativo do plano: 2–3 semanas, após resolver entradas da Fase 0; não é promessa de calendário.

## Objetivo e condição de entrada

Entregar fatos sintéticos → mundo → decisão de fala → texto pt-BR → confirmação de reprodução, sem câmera/modelo real. Cada fatia fecha esse ciclo no simulador. A integração câmera→fala real pertence à Fase 2; não antecipá-la sob aparência de protótipo validado.

Entradas: protótipo completo/README/manifests; resultado reproduzido ou falhas explicitamente registradas; entrevistas/conjunto/benchmark da Fase 0 concluídos ou pendências formalmente aceitas pelo usuário; aprovação deste plano e dos ajustes de contrato em DECISOES. Nenhuma dependência de modelo é necessária para implementar/testar o cérebro depois dessa aprovação.

## Cinco linhas antes do primeiro épico

Quem usa: pessoa cega/baixa visão adulta que precisa formar um mapa mental de um lugar interno.
Situação: chegada, câmera estável, giro, pergunta e silêncio; nesta fase representados por fatos simulados.
O que ouve: informações úteis, breves e direcionais, admitindo incerteza.
O que não pode acontecer: repetição sem mudança, distância inventada, marcação prematura de fala, fala no giro ou informação vencida.
Como provar: cenários determinísticos, propriedades, confirmações de fala simuladas e evidência por CA, sem alegar validação de visão/usuários.

## Sequência de trabalho e entregas verificáveis

| Tarefa / esforço indicativo | Dependências | Mudança planejada | Teste e evidência | Critérios |
|---|---|---|---|---|
| F1-01 — inventário e baseline (1 dia) | Entradas acima | Reexecutar protótipo sem corrigir expectativas; inventariar testes, transcrições e lacunas; decidir reaproveitamento por módulo | Saídas completas, hash de origem e tabela teste→CA; distinguir import fail de falha lógica | CA-E1/E5; base para CA-F1…F9 |
| F1-02 — contratos, relógio e configuração (1 dia) | F1-01 | TS estrito, fatos canônicos, IDs, frame/timestamps, erro explícito; parâmetros centralizados com unidade, motivo e faixa; zero dependência de modelo | Fixtures inválidas, tempo fora de ordem, relógio monotônico, tipos impedindo distância relativa como métrica | CA-P6, CA-E1/E4 |
| F1-03 — primeira fatia estável (2 dias) | F1-02 | Geometria, léxico inicial, World mínimo, Narrator/Realizer e confirmação de fala simulada; uma cena gera briefing e depois silêncio | Oito setores; cena com cadeira/porta; sem depth gera só direção; não falar antes de confirmação de entidade | CA-F1/F2/F3/F8, CA-P6 |
| F1-04 — mundo persistente e mudança material (2 dias) | F1-03 | Associação, confirmação, duplicatas, faltas apenas no FOV, entidade só com bearing, memória antiga/dinâmica; velocidade no referencial do mundo | Ruído/perdas, retorno ao FOV, mesma cadeira com jitter, duas cadeiras separadas, usuário gira/anda, distância 61%/60%/59% da dita | CA-F4, CA-P5/P6 em simulação |
| F1-05 — lugar e briefing honesto (1 dia) | F1-04 | SceneEstimator com priors + probabilidades sintéticas, abstenção/margem/histerese configuradas, corredor no vocabulário | Mesa/cadeira ambíguas; classifier ausente/conflitante; seis ambientes sintéticos; briefing após estabilidade em ≤ 5 s | CA-F9/F7; não aprova CA-P4 real |
| F1-06 — fila, reprodução e giro (2 dias) | F1-03/F1-04 | Prioridade, TTL, eventos iniciar/concluir/cancelar; marcar só fatos ouvidos; devolver pendentes ao planejador com fatos atuais | Cancelar antes/depois de iniciar; TTL na fila; callbacks tardios; mudança durante fala; alertas; giro > 15°/s cancela/bloqueia e replaneja após estabilidade | CA-F4/F5/F6 |
| F1-07 — linguagem e perguntas (1–2 dias) | F1-05/F1-06 | Realizer determinístico; concordância completa do léxico, frases fixas, agrupamento máximo 3 itens; seis pedidos (frente, descrever, lugar, procurar, repetir, mapear) | Tabela de cada classe/singular/plural/artigo; sinônimos; memória antiga; repetir só por pedido; sensor ausente; limites de palavras | CA-F2/F3/F4/F7/F8/F9 |
| F1-08 — cenários e regressão (2 dias) | F1-04…F1-07 | Simulador, seis lugares, seeds e relógio fixos, perda/jitter/FP, caminhadas/parada/giro/aproximação; verdade-terreno separada | Executar matriz abaixo; salvar fatos, eventos de voz e transcrições; diferença textual precisa de justificativa e CA | CA-F1…F9, CA-P5/P6 simulados |
| F1-09 — fechamento técnico (1 dia) | F1-08 | Lint/tipos/formatação, cobertura, testes e simulador na CI quando repositório estiver disponível; docs de instalação e limites | Cérebro ≥ 85% de cobertura; relatório por CA, sem testes tautológicos; build/checks locais e CI correspondentes | CA-E1/E2 (recorte cérebro), CA-E4/E5 |

Estimativa total: aproximadamente 13–15 dias úteis, dependendo de falhas e entrevistas. Não construir a UI final, câmera ou serviço de percepção nesta fase. Não gerar migração de banco/conta/nuvem. F1-03 começa com léxico pequeno para fechar o ciclo; F1-07 expande o vocabulário útil sem fingir que o detector cobre todas as classes.

## Matriz de aceite automatizado

| ID | Cenário e assertiva mínima | Artefato futuro em EVIDENCIAS |
|---|---|---|
| CA-F1 | Cena estática durante 300 s simulados × 12 sementes; no máximo 1 fala após briefing; contar reprodução confirmada, não só textos planejados | `F1-F1-silencio` com contagens, sementes e transcrição |
| CA-F2 | Varrer todas as transcrições e fixtures de linguagem: zero expressões proibidas; qualquer referência a objeto tem direção | `F1-F2-linguagem` |
| CA-F3 | Propriedades em oito setores, fronteiras e yaw ±180°: prefixo fixo por setor; depth válido → passos quantizados; depth ausente/inválido → nenhuma distância | `F1-F3-geometria-fala` |
| CA-F4 | Mesma entidade com ruído não fala de novo; nova relevante pode falar; aproximação real a 0,60 da última distância dita pode repetir; 0,61 não; pedido explícito pode repetir; giro isolado não aproxima | `F1-F4-mudanca` |
| CA-F5 | 14,9/15/15,1/30°/s, giro longo, ruído e sensor ausente; nenhuma reprodução enquanto taxa > 15°/s; testar fala já em andamento quando giro começa | `F1-F5-giro` |
| CA-F6 | Enfileirado não é dito; início sem conclusão não marca todos os fatos; expiração/cancelamento replaneja pendentes; confirmação tardia não consome nova fala; nunca recitar texto vencido | `F1-F6-reproducao` |
| CA-F7 | Frase equilibrada ≤ 25 palavras, até 3 itens, um setor; briefing alvo ≤ 45 palavras; definir contador/tokenização na configuração de teste e testar acentos/números | `F1-F7-comprimento` |
| CA-F8 | 100% das entradas do léxico em tabela de singular/plural, gênero, artigo e contagem (incluindo “duas cadeiras/dois sofás”); revisor lê amostra | `F1-F8-lexico` |
| CA-F9 | Com confiança suficiente, lugar entra no briefing; sem classifier/evidência ou com conflito, diz incerteza; não alterna lugares por jitter; corredor está contemplado | `F1-F9-lugar` |
| CA-P5 (simulado) | Pessoas aproximam a ≥ 0,5 m/s no mundo; ≥ 90% dos roteiros positivos avisados; rotação isolada gera 0 avisos de aproximação | `F1-P5-aproximacao-sim` |
| CA-P6 (simulado) | Null/NaN/infinito/não métrico/frame errado/antigo; prior de tamanho isolado; entidade deve poder manter bearing sem dizer passos/metragem | `F1-P6-sem-depth` |

Alertas nesta fase são ensaio de regra, com rótulo experimental nos roteiros; não prova que detector reconheça escadas nem que o app dê tempo para desviar. Casos de aproximação real com câmera e pessoas continuam obrigatórios na Fase 2. Testar ausência de depth também durante pergunta, memória, repetição e replanejamento, não só na ambientação.

## Decisões de implementação a confirmar antes de codar

1. **Modelo espacial:** fato só com direção pode existir sem posição métrica; ele não participa de cálculo de velocidade/distância como se soubesse escala. Fusão aceita apenas fontes válidas com incerteza/proveniência explícitas.
2. **Direção:** setores relativos ao usuário, não à sala nem ao vídeo espelhado. Prefixos em REQUISITOS; não randomizar geografia.
3. **“Dito”:** confirmar unidades curtas de fala e respectivos fatos. Se cancelamento impedir saber o fragmento ouvido, registrar estado parcial e reavaliar de forma conservadora, sem marcar o restante como dito.
4. **Expiração:** texto vencido é descartado; fatos podem voltar como candidatos e ser atualizados. Se objeto deixou de existir, não recontar informação antiga como presente.
5. **Giro:** seguir CA-F5 literalmente: nenhuma fala > 15°/s, incluindo alertas; reavaliar depois. Alerta poder interromper outro canal não é exceção para giro.
6. **Parâmetros:** estabilidade, pausas, TTL e confiança têm um único local de configuração com motivo e testes de fronteira. Limiares do protótipo são hipóteses, não números aprovados por teste real.

## Política de reaproveitamento

Testes/transcrições existentes são contrato de referência somente quando concordam com o plano. Preservar original e fazer alteração justificada: exemplos encontrados são limite de 32 em vez de 25 palavras, briefing 6 em vez de 5 s, e prior de tamanho classificado como profundidade conhecida. Não apagar testes só para esconder regressão. Reaproveitar módulos apenas após tipos, testes e evidências; não copiar backend real como se houvesse sido validado por mocks.

## Saída da Fase 1

- CA-F1…F9 aprovados em simulação, com saídas e CAs ligados ao mesmo commit/versão. CA-P5/P6 com evidência simulada claramente rotulada.
- Cobertura do cérebro ≥ 85%, tipos/lint/testes/transcrições sem falhas; CI reproduzível quando disponível. A meta de 70% da percepção não pertence a este recorte.
- README com comandos reproduzíveis; ARQUITETURA descreve o implementado; LIMITES exibe lacunas reais; DECISOES atualiza variantes escolhidas e motivos.
- Tabela “não testado” inclui visão/câmera real, áudio real, acessibilidade assistiva, benchmarks e usuários. Uma fatia sintética aprovada não recebe rótulo “segura” nem “acessibilidade validada”.

## Critérios que ficam para fases seguintes

| Critérios | Evidência necessária mais tarde |
|---|---|
| CA-P1…P4 e parcela real CA-P5/P6 | Modelos e câmera em cenas anotadas, metros/ângulos medidos e análise de lacunas |
| CA-D1…D5 | PC de referência, fluxo real, áudio sincronizado e resistência |
| CA-A1…A3 | Interface implementada, axe/teclado/contraste e NVDA/VoiceOver/TalkBack |
| CA-A4/A5 | Sessões com ≥ 8 pessoas conforme REQUISITOS e §13 |
| CA-E1/E2 completos e CA-E3 | CI de todas as camadas, cobertura percepção e instalação Windows cronometrada por pessoa externa |
| CA-S1…S4 | Inspeção de disco/portas/tráfego e E2E de consentimento/apagar |

**Ponto de parada atual:** nenhum item F1 foi iniciado. A revisão da Fase 0 contém pendências reais, descritas em FASE-0.md; aguardar decisão do usuário antes de codar.
