# Reteste da fala Luna expirada — 22/10/2026

## Confirmação posterior com webcam — 22/10/2026, 23h23 (America/Sao_Paulo)

O usuário informou “Agora funcionou” e enviou `C:\meu\plan\visiora-diagnosticoluna.json` (SHA-256 `99FA1DB48F9A39E52C45E378EFEC1C54E7FD08DBCFACA06CC35BF83E8C6F7431`). O arquivo não foi copiado ao repositório. `onlineContinuity.deliveryPolicy="adr-029"` confirma que a revisão nova estava carregada. A sessão Luna registrou 4 consultas despachadas e aceitas, 3 entregas confirmadas, 0 retiradas por mudança ampla, 0 decisões de silêncio, 0 recuperações e `lastError=null`. O contador geral de voz mostra 3 conclusões desde o carregamento da página; coincide com as 3 entregas, mas não substitui a confirmação audível do usuário.

No momento da exportação, `source="idle"`, `running=false`, `pending=false`, `capture.fresh=false` e `paused=true`: o usuário já havia parado a sessão. Portanto `paused=true` nesse arquivo não é evidência de nova pausa por expiração. Uma das 4 respostas aceitas não aparece como entrega; o diagnóstico não informa se houve interrupção voluntária, troca de cena ou outro motivo. A fala bem-sucedida é sustentada pelo relato do usuário e pelos três eventos confirmados, sem transcrição, cronômetro ponta a ponta ou verificação independente de áudio/precisão. Critérios CA-F6/CA-L4: **ensaio manual de funcionamento observado**, não aceite completo com pessoas cegas (CA-A4/A5). Nenhuma imagem ou descrição da sessão foi armazenada neste registro.

## Observação real e alcance

O usuário recarregou o Visiora no navegador e repetiu o ensaio com a webcam. A tela mostrou pessoa, cadeira, janela e a legenda Luna sobre uma captura de onze segundos; o aviso continuou: “A descrição expirou antes de poder falar. O acompanhamento foi pausado.” Isso reprova a conclusão de que a correção ADR-028 bastava para o uso real. O reteste veio por captura de tela, sem novo JSON de diagnóstico, horários da voz ou identificação do build carregado. Não se pode determinar só pela imagem se o navegador ainda usava JavaScript antigo do cache offline, se a voz iniciou e foi cancelada aos dez segundos, ou se ficou na fila até expirar. A mesma mensagem é compatível com mais de uma dessas sequências.

Condições conhecidas: entrada de webcam ao vivo conforme relato do usuário; modelo Luna selecionado na interface. O inventário do ensaio anterior indicou Logitech C925e e computador i7-10700F com cerca de 24 GiB de RAM, mas esses dados não foram reconfirmados neste reteste. Iluminação interna aparece na captura, sem medição. Build efetivamente executado, versão da voz local, modelo declarado pela API nesta nova chamada e latência de captura→voz não foram medidos. A imagem não foi copiada para o repositório.

## Defeitos encontrados no código

1. `OnlineSession.withdrawDirections` cancelava a fala ao atingir dez segundos desde a captura, mesmo se ela tivesse começado validamente e a vista continuasse igual. O primeiro briefing da Luna pode ser longo; a expiração durante a leitura causa pausa sem falha da API.
2. Se a voz não começasse antes da expiração, o fluxo reapresentava a captura velha; a regra anterior pausava imediatamente quando não havia mudança ampla. A expiração da saída deve ser tratada separadamente de resposta inválida da API.
3. `sw.js` usava o mesmo nome de cache `visiora-v0.3.0` entre builds e priorizava esse cache. Se o pacote offline tivesse sido preparado, uma recarga poderia continuar carregando o código antigo. O reteste não comprova que isso ocorreu no navegador do usuário; é um risco real do mecanismo de atualização.

## Correção local

Uma fala Luna iniciada antes do prazo de dez segundos pode concluir depois, mas somente se a vista e a sessão continuarem válidas. A frase já indica que é uma captura passada; posições de uma vista amplamente alterada ainda são retiradas, inclusive durante a fala. Conclusão só confirma memória após início e fim válidos. Uma fala que não iniciou dentro do prazo é descartada. O automático admite uma nova captura após 15 segundos, sujeita ao intervalo, câmera/saída disponíveis, consentimento, reserva e teto diário. Segunda expiração consecutiva sem entrega pausa. O diagnóstico marca `speech-expired`; uma entrega válida reinicia essa contagem. Se a voz iniciar mas não concluir em 60 segundos, o aplicativo cancela e pausa com `speech-timeout`, sem nova consulta. Isso não aumenta o prazo para **aceitar** resposta da API nem permite iniciar fala com captura de mais de dez segundos.

O build calcula uma revisão a partir dos arquivos do aplicativo para `sw.js`. Ao ativar, o novo service worker remove caches antigos `visiora-*`. O cache continua limitado a arquivos estáticos permitidos; respostas da API e imagens da câmera não entram nele. Uma instalação offline anterior precisará preparar os arquivos novamente após uma atualização. Nenhum segredo, modelo, prompt, gateway, ledger ou limite de US$ 2/dia foi alterado.

O diagnóstico novo inclui `onlineContinuity.deliveryPolicy="adr-029"`. Se um próximo arquivo exportado não trouxer esse campo, o navegador ainda executa código anterior; o nome da versão 0.3.0 sozinho não diferencia builds locais.

## Verificação

| Critério | Ensaio | Resultado |
| --- | --- | --- |
| CA-F6 / CA-L4 | Teste Node da sessão: fala iniciada dentro da validade continua depois dos dez segundos e é confirmada ao concluir | Passou |
| CA-F6 / CA-L4 / CA-L3 | Fala que não iniciou expira; uma recuperação após 15 s; segunda expiração pausa; resposta da API sozinha não reinicia a contagem | Passou |
| CA-F6 / CA-L4 | Callback de voz que não conclui até 60 s cancela e pausa sem nova consulta | Passou |
| CA-E1 | Simulação da ativação do service worker remove cache antigo e preserva cache atual e de outro aplicativo | Passou |
| CA-E1 | `npm test` 161/161, `npm run typecheck`, `npm run lint` e verificação de formato | Passaram |

**Limites após a confirmação manual:** o usuário recarregou o navegador, executou uma nova sessão Luna com webcam e informou que funcionou. Permanecem sem medição independente: áudio físico/transcrição/latência ponta a ponta, leitor de tela, custo/fatura, qualidade das direções, resistência prolongada e uso por pessoas cegas/baixa visão. Os testes Node reproduzem a transição de estado; a confirmação real é o relato do usuário e os contadores acima. Nenhuma chamada paga foi feita pelo agente; as quatro consultas foram iniciadas pelo usuário no app.
