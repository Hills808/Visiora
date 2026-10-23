# Acompanhamento automático do Visiora

## Reteste da expiração da fala — 22/10/2026

O usuário recarregou o piloto e viu novamente a pausa por descrição expirada no modo Luna. O fluxo também cancelava falas que já haviam começado quando a captura alcançava dez segundos. Agora uma fala iniciada dentro do prazo pode terminar, desde que a vista não mude amplamente; continua sendo uma descrição de captura passada. Se a fala não começar, o aplicativo descarta essa saída e permite **uma** nova captura após 15 segundos, dentro do orçamento e sem reutilizar a imagem antiga. Uma segunda expiração consecutiva pausa e expõe o motivo `speech-expired` no diagnóstico. Uma fala entregue reinicia a contagem. O cache offline recebe uma revisão nova a cada build e remove a versão antiga ao ativar. Em sessão posterior, o usuário confirmou funcionamento com webcam: diagnóstico `adr-029`, três entregas, nenhum erro. Ver [evidência e limites](EVIDENCIAS/LUNA-FALA-EXPIRADA-RETESTE-2026-10-22.md).

## Correção após ensaio com webcam — 22/10/2026

Uma resposta Luna aceita pode perder as posições quando a imagem muda amplamente antes da fala. O primeiro ajuste cobriu essa transição, mas o reteste mostrou expiração também sem mudança ampla e durante a fala. A regra acima sucede a pausa anterior por expiração na vista estática. O ensaio inicial está em [LUNA-EXPIRACAO-WEBCAM-2026-10-22.md](EVIDENCIAS/LUNA-EXPIRACAO-WEBCAM-2026-10-22.md).

## Memória e comunicação atuais — ADR-026

O automático prioriza novidades visíveis antes de ausências e itens confirmados antes de incertos, preservando a ordem de utilidade da análise. Atualizações têm até 25 palavras, incluindo fonte e idade; primeiro briefing e reorientação têm até 45. Itens agrupados compartilham direção. Uma ausência que perde espaço para novidade entregue é retirada da memória de referências, sem virar lembrete atrasado; conteúdo omitido não é tratado como falado.

Pequena oscilação no limite de setor ou de certeza não repete a descrição. Troca de nome de lugar na mesma vista pede duas capturas distintas recentes; primeiro briefing e vista amplamente nova não esperam isso. Os padrões são hipóteses para avaliação, não prova de reconhecimento. Referências não vistas por mais de 30 s saem da memória linguística; isso não aumenta a validade visual de 10 s. Nomes diferentes para o mesmo item ainda podem repetir.

Ausências são ditas sem posição antiga: “Não identifiquei pessoas nesta captura.” Uma captura que perdeu sua vista não recupera posições quando pixels parecidos retornam. Só uma captura nova pode fornecer direções novamente; posições expiradas ou sem quadro recente saem da lista. Interrupção/conclusão inválida não contam como entrega nem histórico. Repetir explicitamente continua sendo memória rotulada com idade.

[Evidências](EVIDENCIAS/MEMORIA-COMUNICACAO.md), [avaliação MC-01](AVALIACAO-MEMORIA-COMUNICACAO.md) e [ficha vazia](FICHA-AVALIACAO-MEMORIA.csv). Nenhuma sessão humana realizada. Build atualizado: recarregue com Ctrl+Shift+R. Este incremento não altera servidor/API/modelo ou orçamento diário; se o gateway ainda for anterior à ADR-025, reinicie-o para aplicar a regra diária já documentada.

## Como usar a versão local

1. Na pasta `visiora`, pare o servidor antigo com Ctrl+C. Execute `npm run build` e depois `npm run dev:luna`.
2. Abra `http://127.0.0.1:8080` e recarregue a página. Selecione Luna, leia e marque a autorização de envio automático de imagens.
3. Ative a ambientação. A análise começa no primeiro quadro recente disponível, sem esperar estabilização ou apertar Descrever. A voz depende do retorno da análise.
4. O sistema observa mudanças na imagem localmente. Com quadro recente e saída disponível, respeita o intervalo, envia uma nova captura e descreve novidades, mesmo com movimento. Os botões de pergunta são complementares, não o fluxo principal.
5. Parar, desmarcar a autorização ou colocar a página em segundo plano impede novos envios. Pausar a voz também suspende novos envios automáticos. Uma chamada já enviada pode ser cobrada mesmo após cancelar.

Use uma voz local pt-BR ou o modo leitor de tela. Sem voz disponível no modo de voz, o automático aguarda a configuração em vez de cobrar consultas silenciosas. Não se promete áudio audível apenas pelo callback do navegador.

## O que esta versão faz

- Analisa a primeira imagem disponível e novas imagens após mudanças relevantes para o detector visual de mudança. Uma análise por vez, sem fila de imagens antigas; não exige uma imagem perfeita ou estabilização.
- Agrupa até três itens por direção: “À sua frente, há uma janela, uma pessoa e uma cama.” Mantém frases diferentes para setores diferentes e separa itens incertos (“talvez haja”) dos demais. Não varia direções aleatoriamente.
- Mantém silêncio para referências já descritas. Compara nomes normalizados, setor na câmera, incerteza e contagem por grupo; só confirma a descrição após a voz terminar. No leitor de tela, confirma disponibilidade do texto, não audição.
- Descreve mudanças de lugar e novas referências visíveis. Uma alteração ampla na estrutura da imagem permite nova orientação mesmo se o nome do ambiente continuar igual. Isso não comprova deslocamento físico. Pessoas têm contagem aproximada quando agrupadas no mesmo setor.
- Se uma pessoa antes descrita deixa de ser identificada, avisa isso mesmo que móveis continuem iguais: “não identifiquei pessoas nesta captura”. Não afirma que a pessoa saiu fisicamente. Referências ausentes podem voltar a ser anunciadas quando identificadas novamente. Ausência de todos os itens é qualificada como não confirmação, nunca caminho livre.
- Prioriza passagens, portas, aberturas e placas relevantes quando o modelo encontra evidência nos pixels. Não deduz o lugar a partir de objetos nem usa um catálogo de ambientes como alternativas no prompt. Nenhuma porta é automaticamente declarada saída para fora, passagem acessível ou caminho livre.
- Mantém a conferência do modelo da API e limites persistentes de gasto. Mudanças pequenas durante análise/voz não apagam uma descrição identificada como captura passada. Mudança estrutural ampla retira as posições anteriores e interrompe uma fala direcional em andamento; pode dizer apenas o contexto histórico do lugar, sem repeti-lo se já foi dito. A próxima captura usa uma imagem recente, sem esperar estabilidade.

## Frequência e gasto

Intervalo mínimo de 4,5 segundos entre envios, com uma imagem por vez e sem envios periódicos de uma vista inalterada. O tempo real depende de quadros disponíveis, rede, API e voz. O gateway permite no máximo 15 consultas/minuto, com intervalo mínimo de 4 segundos. Esses são limites, não uma promessa de frequência. A retirada do bloqueio de estabilidade pode aumentar consultas durante movimento, dentro dos mesmos tetos.

As imagens são comparadas em uma impressão RGB de 32×24 pixels no próprio navegador, somente em memória. Gatilhos experimentais: diferença média ≥0,04; alteração ≥0,15 em pelo menos 2% dos canais; ou mudança média ≥0,08 em pelo menos dois blocos de 4×4. O último ajuda a perceber mudanças pequenas que desapareciam na média global. Uma vista amplamente diferente exige ≥45% dos canais alterados e diferença estrutural ≥0,06 após retirar o deslocamento uniforme de cor/brilho. Essa heurística não identifica objetos, lugar ou pose. Não foi medida sua precisão com câmera física.

O servidor exige consentimento e reserva US$ 0,30 antes de cada chamada. Conforme a correção explícita do usuário em 19/10/2026 (ADR-025), o teto autorizado é **US$ 2 por dia**, renovado à meia-noite em `America/Sao_Paulo`, sem teto acumulado de US$ 2. Consultas anteriores são atribuídas pelo horário original de início, sem reescrever o histórico. Reservas incertas permanecem no dia de origem; pendência em andamento continua bloqueando concorrência mesmo na virada do dia. `VISIORA_DAILY_USD` permanece em 2 no piloto; a variável histórica `VISIORA_TOTAL_USD` não é mais usada. Não foram alterados a chave, o ledger real ou as reservas antigas. A reserva não é o preço de uma imagem; o controle local não comprova o valor faturado pelo provedor.

Falha temporária conhecida de rede/serviço, timeout ou captura recebida acima da validade permite **uma nova tentativa**, depois de pelo menos 15 segundos e quando câmera/saída estiverem disponíveis. Há aviso curto. Usa captura atual e pedido novo, sujeito a nova reserva; a reserva da falha incerta não é liberada. Segunda falha consecutiva pausa. Uma resposta válida reinicia a contagem de falhas. Orçamento, taxa, credencial, consentimento, modelo divergente, contrato inválido e falha interna pausam imediatamente, sem recuperação automática. Parar/revogar cancela a recuperação. Sem fila nem repetição automática pelo gateway.

O consentimento do protocolo passou a `cloud-v3-continuity`, com a recuperação limitada informada na tela. Clientes antigos `cloud-v1` e `cloud-v2-auto` são rejeitados. A autorização começa desmarcada após recarregar/parar.

Na Ajuda, “Exportar diagnóstico local” inclui contagens de consultas, respostas aceitas, posições retiradas por mudança ampla (`obsolete`), decisões de silêncio, entregas e recuperações, além do último código de erro. `obsolete` pode coexistir com resposta aceita: seu contexto histórico pode ser aproveitado. Não inclui descrições, imagens nem impressão RGB. No terminal, `npm run luna:models` também mostra códigos de falhas registradas no servidor atualizado. Falhas antigas sem código continuam sem causa conhecida.

## Limites que continuam

O acompanhamento é feito por capturas intermitentes: não é vídeo interpretado continuamente e não responde a toda mudança em tempo real. Movimento não bloqueia a análise, mas desfoque e mudança rápida podem reduzir a qualidade. Mudanças amplas contínuas podem limitar a fala ao contexto histórico, sem posições. Pode perder mudanças pequenas, confundir iluminação com mudança e gastar uma consulta cuja descrição seja depois descartada ou repetida em significado. Alterações de nomes pelo modelo podem escapar da deduplicação.

Direção é relativa à câmera e depende da caixa estimada pelo modelo. Não mede posição do corpo, metros/passos ou giro físico; não tem mapa 360° nem reidentificação de objetos/pessoas entre vistas. Duas instâncias com o mesmo nome/setor podem ser confundidas. Não mede aproximação confiável, não garante segurança e não substitui bengala/cão-guia.

Resultados podem iniciar fala somente até dez segundos após a captura e sempre são descrições com idade explícita, nunca fatos confirmados do mundo atual. Uma fala iniciada validamente pode terminar depois desse prazo se a vista continuar válida; capturas mais antigas não iniciam nova fala. Não alteramos o limite original de três segundos para fatos atuais. Ainda faltam benchmark independente de qualidade, latência e custo, uso com câmera física por tempo prolongado, leitores de tela e pessoas cegas. A versão publicada continua 0.3; esta mudança é do piloto local.

Veja ADR-024 e `EVIDENCIAS/LUNA-MOVIMENTO-FALA.md` para a mudança atual. ADR-021/020 e suas evidências registram os incrementos anteriores. Câmera em caminhada, áudio físico e uso com pessoas cegas ainda não foram testados nesta revisão.
