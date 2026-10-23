# Continuidade do piloto Luna — evidências

Data: 18/10/2026. Incremento local, não publicado. Relato motivador: câmera parada ficou em silêncio, mas mudar de lugar/deixar o enquadramento não gerou retorno suficiente. O relato do usuário não é uma medição de precisão. Nenhuma chamada paga foi feita pelo agente nesta revisão. Chave, limites e conteúdo do ledger real foram preservados.

## Diagnóstico observado

As quatro consultas mais recentes do ledger real, inspecionado somente para leitura, intercalavam duas concluídas com `gpt-6-luna` verificado (23:07:33 e 23:08:40 UTC) e duas incertas sem metadado de modelo (23:07:57 e 23:09:05 UTC). O registro antigo não guardava o motivo: não se pode afirmar retrospectivamente timeout, rede ou outro erro. O automático anterior pausava após qualquer falha. A memória também ignorava pessoa ausente quando outros itens continuavam iguais. Ambas as limitações foram reproduzidas pela leitura da lógica e cobertas pelos testes desta revisão.

## Verificações executadas

| Verificação | Resultado | Critérios relacionados |
| --- | --- | --- |
| `npm test`, com build | 109 testes passaram, zero falhas/ignorados | CA-E1 parcial; CA-F4/F6/F9, CA-L1..L4 |
| `npm run typecheck` | Passou | CA-E1 no cliente/cérebro; gateway permanece JavaScript |
| `npm run lint` | Passou | CA-E1 parcial |
| Simulador local comparado como JSON à referência anterior | Seis transcrições idênticas | Regressão do modo local |
| `node tests/e2e/luna.mjs` | Dez cenários passaram, sete chamadas fake, zero erros de página | CA-F4/F6, CA-L1..L4; parcelas automatizadas |
| `node tests/e2e/luna-continuity.mjs` | Oito cenários passaram, dez chamadas fake, zero erros de página | CA-F4/F6/F9, CA-L2/L3/L4; parcelas automatizadas |

Saída unitária: [luna-continuity-tests.txt](luna-continuity-tests.txt). Relatórios/transcrições: [luna-continuity-base-e2e.json](luna-continuity-base-e2e.json), [luna-continuity-e2e.json](luna-continuity-e2e.json). Regressão local: [luna-continuity-local.jsonl](luna-continuity-local.jsonl). CA-L* são os critérios adicionais de `PLANO-MIGRACAO-LUNA-6.md`; estes resultados cobrem as partes descritas, sem declarar aceite completo de qualidade, privacidade ou desempenho.

## O que foi exercitado

- Pessoa antes descrita deixa de ser identificada, com cadeira mantida: avisa “não identifiquei pessoas nesta captura”, sem afirmar saída física. Repete só após nova evidência relevante; retorno pode ser anunciado. Planejamento/interrupção não confirma ausência como já dita.
- Mudança moderada em dois blocos de 4×4 da impressão 32×24 agenda análise, mesmo abaixo dos antigos limiares globais. Cinco minutos estáticos com ruído baixo, em doze sementes do teste, mantêm uma chamada inicial. Isso é simulação numérica, não vídeo real de cinco minutos.
- Mudança estrutural ampla permite nova orientação mesmo com mesmo nome do ambiente. Deslocamento uniforme de cor/brilho não ativa essa classificação ampla. Não se demonstrou separação confiável de iluminação/movimento em cenas reais.
- Uma alteração lenta/localizada durante chamada em voo descarta aquela resposta e analisa a vista mais recente antes de falar. Comparação para reorientar usa a última captura aceita, e não uma captura rejeitada. Sem fila de imagens antigas.
- Primeira falha temporária conhecida avisa e aguarda pelo menos 15 s; usa nova captura e novo ID. Segunda falha consecutiva pausa; mudança de pixels não reativa o automático. Parar cancela recuperação e câmera. Sucesso reinicia a contagem. Configuração, orçamento, acesso, modelo e contrato inválidos não ganham tentativa automática.
- Transporte diferencia timeout, rede, indisponibilidade, limite e credencial com códigos permitidos, sem copiar mensagem privada da API. Testes mantêm reserva de US$ 0,30 em falha incerta. Ledger antigo continua preservando gasto/pendência e não ganha confirmação retroativa.
- Cliente sozinho e gateway não repetem pedidos; a única recuperação está no agendador da sessão. Uma tentativa nova passa novamente por quota/reserva. Testes de concorrência, idempotência e orçamento existentes continuam passando.
- Exportação opt-in inclui contagens/estado e código de erro, sem cena, imagem ou impressão RGB. Novo consentimento `cloud-v3-continuity`; os protocolos v1 e v2 são rejeitados pelo gateway atualizado. Parar/revogar/ocultar continuam encerrando a sessão.
- Regressão E2E mantém início sem perguntas, repetição sem API, consulta aberta, descrição de passagem sem garantir saída, silêncio com mesmos fatos, espera por diálogo, cancelamento de início/análise e pausa após erro interno. A transcrição agora também qualifica a referência anterior não confirmada.

O E2E novo inicialmente falhou por tentar clicar em diagnóstico dentro de uma seção recolhida da Ajuda; o roteiro foi corrigido para abrir a seção. O encerramento do teste também foi ajustado para ler o banco em memória antes do fechamento do servidor, preservando a mensagem original em caso de falha. Rodada final passou. Não se adicionou regra específica de pessoa/lugar para os dados do teste.

## Limites / não testado

HTTP loopback e captura JPEG são reais, mas vídeo, mudanças de impressão, evidências, voz e parte do relógio são artificiais. O vídeo público usado na captura não corresponde às descrições fake de escritório/cerâmica. Isso testa integração, não visão do Luna.

Não executado nesta revisão: câmera física/API real em acompanhamento, áudio audível, precisão ou omissões de ambientes/pessoas/objetos/passagens, identidade entre vistas, gatilhos com iluminação/movimento reais, latência p95/ponta a ponta, custo/fatura, smartphone, leitores de tela, usuários cegos/baixa visão, sessão prolongada, bateria/RAM e offline/service worker. O usuário já relatou API/voz funcionando na versão anterior; não é validação desta revisão.

Intervalo mínimo de 4,5 s não garante resposta nesse tempo. Movimento contínuo, validade de dez segundos, rede/serviço e orçamento ainda podem impedir descrições. Consulta incerta conserva a reserva e a recuperação consome nova reserva; não apagar o ledger para destravar. Nenhuma ampliação dos US$ 2/dia e US$ 2 totais. Não há navegação, profundidade medida ou garantia de caminho livre. CA-D1/D2/D3, CA-P4, CA-A4/A5 e aceite final permanecem pendentes.

## Próximo ensaio do usuário

Reinicie o gateway atualizado, recarregue o navegador com Ctrl+Shift+R e autorize novamente o envio. Compare: (1) pessoa/cadeira presentes, (2) pessoa fora do enquadramento e cadeira mantida, (3) novo enquadramento estável e (4) câmera parada. Observe retorno curto em mudanças identificadas e silêncio com mesmos fatos. Se houver pausa, guarde somente diagnóstico e códigos de `npm run luna:models`; não envie a chave. O ensaio consome o orçamento existente e não comprova segurança/precisão geral.
