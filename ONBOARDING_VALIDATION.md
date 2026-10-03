# Onboarding de hábito — validação

Implementado em 02/10/2026. Fluxo de doze etapas, sem novos serviços ou dependências.

## Verificações locais

- Typecheck e lint do app: passaram.
- `npx tsx --test tests/onboarding-content.test.ts`: quatro testes passaram. Incluem as 36 combinações da mensagem, respostas inválidas, migração de etapas e reset com o router da versão instalada do Expo.
- Seis testes do store passaram em bundle Node isolado. Somente `Platform` e `StyleSheet` foram substituídos; a normalização, as ações e a gravação/leitura do storage em memória são as implementações reais.
- Checagem ampliada de `tests/library-persistence.test.ts` no mesmo bundle isolado: 16/18 passaram. As duas falhas fora do onboarding foram a comparação de notas normalizadas com campos opcionais `undefined` e a expectativa antiga `sunset` (normalizada para `day`). Nenhuma mudança nesses comportamentos foi feita neste trabalho.
- Runner padrão de `tests/onboarding.test.ts`: bloqueado antes dos testes por `react-native/index.js:27:7: Unexpected "typeof"` (Flow no runner Node/tsx). O bundle isolado não equivale a validação do SQLite nativo.

## Conferido no simulador iOS

iPhone 17 Pro, iOS 26.2, development client e Metro locais:

- Avançar pelas sete etapas; seleção obrigatória nas perguntas e mensagem com nome/frequência/intenção/horário.
- Voltar mantendo as escolhas e retomar a quinta tela após encerrar e reabrir o app.
- Reabrir pelo perfil na primeira etapa, com nome e respostas preenchidos.
- Abrir o catálogo, retornar à etapa do primeiro livro e concluir com livro existente.
- Pular individualmente nas sete etapas e voltar à sala.
- Cores claras e noturnas, poses 3D e 2D.
- Limite de 50 caracteres no nome. No maior tamanho de fonte de acessibilidade, input acessível por rolagem e ação principal visível.
- Biblioteca, perfil, iluminação e cronômetro originais foram restaurados depois do uso de fixtures temporários. O app voltou à sessão de leitura que já estava em andamento.

## Ainda sem verificação em dispositivo

- Android e aparelhos físicos iOS.
- Teclado virtual aberto: a digitação usou o teclado de hardware do simulador.
- Tela menor que o simulador utilizado e redução de movimento ativada no sistema.
- Adição de um livro novo no catálogo, cadastro manual, adição rápida e confirmação de pulo sem livros. O fluxo existente foi preservado; o teste nativo usou uma biblioteca com livro já cadastrado.
- Gesto de voltar do iOS e botão de voltar do Android: o histórico foi validado pelo teste do router; as saídas foram exercitadas no iOS, mas esses gestos físicos não foram automatizados.

## Imagens

Em `assets/onboarding`: acolhimento 3D, livro fechado 2D, livro aberto 2D, pausa com caneca 2D e leitura 3D. Geradas a partir de `assets/niko-mascot.png`, com fundo transparente, óculos terracota, detalhes verdes e sem texto incorporado.

Prompt set usado com a ferramenta integrada de geração: preservar identidade e silhueta do Niko, óculos terracota e detalhes verdes; personagem inteiro centralizado, fundo transparente e nenhum texto. Poses: aceno acolhedor em 3D (`niko-welcome.png`), livro fechado junto ao peito em ilustração 2D cozy (`niko-rhythm.png`), livro aberto em 2D (`niko-intention.png`), pausa com caneca em 2D (`niko-moment.png`), sentado lendo livro verde em 3D (`niko-reading.png`). Os três assets 2D receberam uma segunda geração de transferência de estilo para eliminar o acabamento volumétrico.

## Continuação: primeiro livro e apresentação das funções

As sete etapas originais foram ampliadas para onze. A versão persistida continua 2: a extensão é compatível com as etapas já salvas, e quem concluiu ou pulou continua sem obrigação de refazer.

- Primeiro livro: adição rápida, busca no catálogo ou cadastro manual; é possível continuar sem adicionar agora.
- Timer e notas: exemplos visuais explicativos, sem iniciar uma sessão real nem salvar notas fictícias.
- Quadros: explica que somente capas de livros concluídos ficam disponíveis.
- Personalização: apresenta móveis, posições e iluminação; conclui na sala com reset do histórico.
- Ao adicionar pelo catálogo/cadastro manual com origem onboarding, retorna ao timer e remove as telas intermediárias desse fluxo.

Verificado nesta continuação no iPhone 17 Pro / iOS 26.2:

- Adição rápida de Dom Casmurro avança para o timer.
- Busca no catálogo, abertura da prévia de The 48 Laws of Power e adição retornam ao timer.
- Avanço por timer, notas, quadros e personalização; conclusão na sala.
- Retorno do timer ao primeiro livro mantém o livro; continuar não encerra o onboarding.
- Fechar/reabrir retoma a etapa de notas.
- Pular individualmente nas quatro novas etapas retorna à sala.
- Timer nos modos claro/noturno e renderização das cinco ilustrações novas.
- Typecheck/lint passaram; quatro testes de conteúdo/navegação e seis testes do store em bundle isolado passaram.
- Fixture temporária removida; SQLite original restaurado exatamente, preservando a sessão de leitura anterior.

Sem nova verificação nativa nesta continuação: cadastro manual, continuar sem livro, fonte ampliada, teclado virtual, redução de movimento, Android e aparelho físico. As verificações das sete etapas acima pertencem à implementação anterior.

Novas imagens geradas com a ferramenta integrada em modo de edição por referência, fundo transparente, a partir de Niko original e da pose 2D existente. Assets em `assets/onboarding/`: `niko-book.png` (3D, colocando um livro na prateleira), `niko-timer.png` (2D, segurando cronômetro), `niko-notes.png` (2D, escrevendo), `niko-frame.png` (3D, segurando quadro com capa) e `niko-room.png` (3D, poltrona e luminária).

Prompt comum: preservar silhueta creme arredondada, óculos terracota, olhos e sobrancelhas castanhos e membros verdes; composição compacta, objeto inteiro dentro da imagem, margens transparentes, nenhum texto, badge ou confete. Nas poses 2D: ilustração cozy plana em lápis de cor, seguindo a segunda referência. Nas poses 3D: acabamento tátil suave, seguindo o mascote original.

## Interatividade das etapas — 02/10/2026

- Busca por título/autor no próprio onboarding envia o termo ao catálogo real. Sugestões agora iniciam uma busca, em vez de cadastrar livros com metadados fixos.
- Timer local com iniciar, pausar, continuar e reiniciar; para ao avançar e não cria sessão no store.
- Nota de demonstração editável (500 caracteres), com prévia e retorno à edição; não é gravada no Diário.
- Prévia das três coleções usando os renders existentes, com alternância dia/noite; não altera a configuração da sala.
- Simulador iPhone 17 Pro: termo digitado chegou ao catálogo e carregou resultados; timer contou, pausou e zerou; nota digitada apareceu na prévia e foi mantida ao editar; troca para Botânica e prévia noturna conferidas visualmente.
- SQLite original restaurado exatamente após a fixture; app voltou ao timer anterior de Dom Casmurro.
- Typecheck e lint passaram. Sem novas verificações Android/aparelho físico/fonte ampliada/redução de movimento nesta alteração.

## Ajuste da demonstração de personalização — 02/10/2026

- Prévia principal maior e título/texto compactos, sem repetir a ilustração do mascote nesta etapa.
- Seleção por miniaturas das três coleções; controle Dia/Noite sempre visível com estado selecionado.
- Deslize horizontal sobre a sala troca a coleção; rolagem vertical continua disponível. Transição de imagem respeita redução de movimento.
- Iluminação inicial da prévia acompanha o modo do app ao abrir o onboarding; escolhas continuam locais à demonstração.
- Conferido no iPhone 17 Pro em modo noturno: conteúdo inteiro visível, deslize Natural → Clássica, seleção Botânica e troca de iluminação. Typecheck e lint passaram.
- Sem nova conferência Android, fonte ampliada ou aparelho físico. Dados originais restaurados após a fixture.


## Login opcional e refinamento da prévia — 02/10/2026

- Última etapa adicionada depois da personalização; total de 12 etapas, mantendo versão 2 e sem reabrir onboarding concluído/pulado.
- Apple/Google reutilizam AuthActions e AuthProvider existentes. Continuar sem conta conclui o onboarding; Pular continua disponível. Configuração de sincronização não alterada: builds sem conta habilitada mostram essa indisponibilidade e permitem seguir.
- Texto explica livros, notas, progresso e sala salvos na conta e acesso em outro aparelho. Sem conta, dados locais e possibilidade de entrar depois pelo Perfil.
- Retorno OAuth permite a rota de callback e retorna ao onboarding. Carregamento de dados de uma conta preserva as etapas/respostas do onboarding em andamento.
- Prévia da sala com controles mais leves, seleção sem preenchimento extra e textos compactos.
- Typecheck e lint passaram. Quatro testes de conteúdo/navegação e seis testes de persistência passaram; store testado com bundle/stub nativo isolado, conforme procedimento acima. Reset inclui callback OAuth no histórico removido.
- Simulador iOS: prévia noturna → login, retorno à prévia, tela final clara e noturna, Apple/Google visíveis, conclusão sem conta persistida na etapa 11 e Pular persistido. Ambos retornaram à sala. Dados originais restaurados exatamente após os testes.
- Não verificados nesta alteração: autenticação real Apple/Google, sincronização remota após login, conflito de conta, Android, fonte ampliada e redução de movimento. Nenhuma conta do usuário foi conectada para testar.


## Notas, ilustração da sala e conta — 03/10/2026

- Notas de exemplo usam getReadingNotePalette do Diário: cartão de exemplo azul, editor colorido, seis cores e criação/edição de prévia local. Nenhuma ação de persistência é chamada pela demo.
- Removidos imagens 3D de coleções, gesto de swipe e controles de prévia. Nova ilustração 2D cozy transparente do Niko e móveis, com orientações de personalização. Asset em assets/onboarding/niko-room-cozy.png.
- Tela final sem conta: Niko, benefícios compactos, Apple/Google e opção explícita de seguir sem login. Conectado: avatar, nome/email e estado real de sincronização, sem repetir convite/benefícios.
- ScrollView reinicia por etapa para evitar recorte da ilustração ao avançar após rolar.
- Typecheck, lint e quatro testes de conteúdo/navegação passaram.
- Simulador iOS: notas, sala ilustrada e conta sem login conferidas em claro/noturno; digitado exemplo, trocada cor para verde, criada prévia e dispensado teclado. Comparação do snapshot confirmou livros/notas intactos após a demo. Dados originais restaurados exatamente.
- Não verificados em dispositivo nesta alteração: estado conectado, autenticação real, Android, fonte ampliada e redução de movimento. Estado conectado validado apenas por código/typecheck.
