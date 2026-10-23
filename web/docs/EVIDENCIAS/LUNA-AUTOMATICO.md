# Acompanhamento automático - evidências locais

Data: 18/10/2026. Piloto local experimental, não publicado. Autorização: usuário pediu análise ao ativar e acompanhamento de mudanças sem clicar em perguntas. Nenhuma chamada paga nesta implementação. Chave, ledger real e tetos não foram alterados. Não foram usadas fotos privadas da conversa em chamadas externas.

## Resultados executados

| Verificação | Resultado | Critérios relacionados |
| --- | --- | --- |
| `npm test` (build incluído) | 103 testes, 103 passaram, zero falhas | CA-E1 (parcela local), CA-L1/L2/L3/L4 |
| `npm run typecheck` | Passou; cliente/cérebro TypeScript estrito | CA-E1, sem declarar tipagem do gateway JavaScript |
| `npm run lint` | Passou | CA-E1 (parcela local) |
| Seis transcrições locais comparadas como JSON com `luna-local/transcricoes-locais.jsonl` | Idênticas | Regressão do modo local; não mede reconhecimento |
| `node tests/e2e/luna.mjs` | 10 cenários, sete chamadas a fornecedor simulado, zero erros de página | CA-F4/F5/F6, CA-L1/L2/L3/L4; partes automatizadas de CA-A1 |
| Layout de 390 px | Sem rolagem horizontal; captura visual inspecionada | Não substitui testes com usuários/contraste/leitor |

Saída completa unitária: [luna-auto-tests.txt](luna-auto-tests.txt). Relatório e transcrição completos: [luna-auto-e2e.json](luna-auto-e2e.json). O navegador usa vídeo público sintético, impressão de mudança controlada pelo teste, evidências e voz artificiais; HTTP loopback e captura JPEG reais. A imagem pública do cachorro/bicicleta pode aparecer enquanto o fornecedor fake descreve cerâmica: isso é fixture de integração explicitamente simulada, não resultado de visão do Luna.

## O que os testes novos demonstram

- Ativar basta para analisar e falar a primeira imagem estável, sem botão de pergunta e sem baixar ONNX no modo Luna.
- Cinco minutos estáticos com ruído baixo, em doze sementes do agendador, geram só um despacho inicial. Isso é teste de lógica, não vídeo real de cinco minutos nem latência de rede.
- Agendador bloqueia durante movimento, chamada pendente, voz/diálogo indisponível e intervalo mínimo de 12 s. Mudança acumulada, alteração localizada e invalidação da vista habilitam captura nova, sem fila e sem apagar o intervalo. Pausa por erro só sai ao reiniciar.
- Na memória, novidade é descrita sem repetir ambiente/objeto já reconhecido; início ou planejamento não confirmam fala. Contagem aproximada de pessoas, setor diferente e hipótese de lugar nova produzem retorno. Ausência de referências é dita como não confirmação daquela captura e não se repete a cada ciclo.
- Mudança RGB no navegador gera automaticamente nova análise e frase sobre passagem visível, sem repetir o lugar. Nova mudança de pixels com as mesmas referências não repete fala. Os nomes são dados do fake; não se demonstrou que Luna realmente detecta a passagem.
- Resultado recebido com ajustes abertos aguarda o diálogo fechar, sem outra chamada; validade é mantida. Parar durante análise e cancelar início rejeitam saída tardia e desligam a câmera.
- Falha do fornecedor pausa, anuncia uma vez e não volta a despachar ao avançar o relógio e mudar pixels. Não há retry pago automático. Testes de quota/reserva/SQLite/modelo anteriores continuam passando. Consentimento antigo `cloud-v1` é rejeitado pelo gateway atualizado.
- Repetir não chama a API. Perguntas manuais continuam disponíveis como complemento. Transcrição automática e pedidos explícitos permanecem distinguíveis pelo roteiro do teste.

O primeiro E2E falhou porque a fixture de “passagem” reutilizou o artigo “um” do torno. Corrigiu-se o dado do fornecedor fake para “uma”; não se introduziu regra de gênero ou alias específico no produto. A rodada final passou. Essa falha reforça que schema válido não prova concordância/verdade do conteúdo de um modelo real.

## Não testado / não concluído

Não executado acompanhamento automático com API real nesta mudança. Não medidos custo/fatura, latência p95, detecção de pequenas mudanças, movimento contínuo, iluminação variável, caixas/direções, precisão de ambientes/objetos/pessoas/passagens ou identificação de saída real. Sem prova de áudio audível nesta alteração, leitor de tela físico, smartphone, sessão de trinta minutos, bateria ou validação com pessoas cegas/baixa visão. O relato anterior do usuário sobre voz funcionando pertence a uma sessão anterior, não a estes testes automáticos.

Não há pose do corpo, identidade de pessoa/objeto entre vistas, mapa 360°, navegação ou garantia de caminho livre. Gatilhos RGB e deduplicação por nome/setor podem perder mudanças ou confundir instâncias. Os resultados continuam capturas antigas com idade; não se cumpre CA-D1/D2/D3 por anunciar “analisando”. CA-P4/A2/A4/A5 e aceite final continuam pendentes. A reserva do aplicativo é controle conservador, não garantia da fatura externa. Publicado continua 0.3; os testes não constituem deploy.
