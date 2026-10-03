# Backup completo — validação em 02/10/2026

## Implementado

O snapshot em `user_library_backups` preserva todos os campos persistidos da biblioteca: sala e suas peças, posições, acabamentos, cores e iluminação; perfil; livros, páginas, avaliações e resenhas; estantes e nomes; notas, favoritos e pastas; sessões e dias de leitura; preferências e estado persistido do onboarding.

Fotos de perfil ficam no bucket privado `profile-avatars` (JPEG, 512 px, 2 MB). Fotos dos quadros ficam no bucket privado `room-photos` (JPEG, 1024 px, 2 MB). O snapshot guarda referências permanentes, sem caminhos locais, URLs assinadas ou estado de envio. As fotos antigas são convertidas para arquivos separados por conta antes do upload.

O snapshot é confirmado após os uploads. Substituições e exclusões de arquivos ocorrem após confirmação da revisão; limpezas pendentes ficam na metadata local da conta. Falhas de upload mantêm o último backup válido e a escolha local. Abertura, retorno ao primeiro plano e ação manual retomam o envio. Logout restaura o convidado e impede respostas antigas de alterar a sessão seguinte.

Cronômetros são enviados pausados, com o tempo acumulado até o backup. A sessão local em execução continua funcionando; restaurar em outro aparelho não contabiliza o intervalo entre aparelhos como leitura.

## Supabase vinculado

Projeto: `hsvkqzpkmxntfejzoyka`.

Migrations aplicadas:

- `20260910000100_open_library_catalog.sql`
- `20260910000200_testflight_waitlist.sql`
- `20260919000100_user_library_backups.sql`
- `20261002000100_profile_avatars.sql`
- `20261002000200_room_photos.sql`
- `20261002000300_backup_revision_conflicts.sql`

A função `delete-account` foi publicada com exclusão dos arquivos dos dois buckets antes da remoção do usuário. A RPC mantém a proteção por revisão e responde com HTTP 409/SQLSTATE PT409 para conflitos. A versão anterior usava SQLSTATE 40001, tratado como erro HTTP 500; o teste expirou antes da correção.

## Evidência remota

Testes com duas contas descartáveis, removidas ao terminar:

- Envio e recuperação de um avatar e duas fotos de quadros, comparando os bytes recuperados.
- Leitura/escrita dos arquivos restritas ao proprietário; convidados e outra conta bloqueados. Tentativa de exclusão por outra conta não remove o arquivo.
- Snapshot preenchido com livros, progresso, notas, pastas, sessão, preferências, sala personalizada e referências das três imagens salvo e relido sem diferenças.
- Snapshot obtido do servidor normalizado em estado local vazio e serializado novamente sem perda de dados.
- Leitura de backup de outra conta e de convidado bloqueada.
- Revisão antiga rejeitada com HTTP 409, preservando a revisão válida.
- Upload sem confirmação não altera o último snapshot válido.
- Exclusão remove usuário, snapshot, imagens confirmadas e imagem sem confirmação nos dois buckets.

## Verificações locais

TypeScript, lint e exportações iOS/Android passaram.

Os quatro testes novos de backup completo, cronômetro e compatibilidade com quadros antigos (visíveis ou ocultos) passaram, assim como os quatro testes de avatar. Para executar os testes existentes de store/sync no Node foi usado um shim temporário de React Native: 12 passaram e 1 expectativa antiga de diário falhou.

Uma simulação temporária das APIs nativas validou migração de fotos antigas, arquivos por conta, interrupção de upload, repetição após arquivo já enviado, interrupção lógica da sessão, cache offline e preservação de fotos para o convidado. Isso não substitui testes nativos.

A suíte padrão mantém as 8 falhas anteriores: 7 arquivos falham ao carregar a sintaxe Flow do React Native no Node (`Unexpected "typeof"`), e 1 teste de personalização tem uma expectativa antiga. Com o shim, ainda há expectativas antigas de diário/persistência e compatibilidade de `sunset`; não foram alteradas neste trabalho.

## Ainda pendente nos aparelhos

- Login e cancelamento reais com Google/Apple; sessão restaurada e logout.
- Restauração entre iPhone e Android, conferindo visualmente sala, quadros e avatar.
- Troca rápida de fotos, interrupção da rede/reabertura e conflitos entre dois aparelhos.
- Exclusão pelo app, confirmando que a biblioteca e as fotos continuam disponíveis para o convidado.

A validação remota comprova o contrato do backend e a restauração dos dados. Ainda não comprova o fluxo completo dos provedores e da interface em aparelhos físicos.

## Correções após o primeiro login Apple

- A troca de armazenamento lê o snapshot antes de alterar a conta ativa, sem zerar o store ou desmontar a navegação. Dois testes de regressão cobrem preservação dos dados e onboarding concluído após restauração/reabertura.
- A chave da metadata passou de `bookroom-sync:<id>` para `bookroom-sync.<id>`: o SecureStore do SDK 57 rejeita dois-pontos. Isso impedia confirmar localmente o backup e também podia interromper a limpeza após excluir a conta no servidor.
- Cache vazio deixado pela falha anterior utiliza os dados do convidado ainda disponíveis, sem substituir um backup remoto diferente sem escolha. Dados já sobrescritos não têm recuperação garantida.
- A decisão de abrir onboarding aguarda a restauração da sessão. Restaurar um backup antigo preserva onboarding concluído neste aparelho.
- Sessão de usuário já excluído é encerrada e retorna ao convidado. Falha na exclusão remota não sobrescreve o convidado; falha na limpeza da metadata após exclusão bem-sucedida não mostra falso erro de exclusão.

Uma simulação do provider com React, backend simulado e validação das chaves como no SecureStore passou: primeiro login e envio dos dados locais, reabertura sem conflito, recuperação do cache vazio, início offline com dados locais, escolha do backup remoto, sessão inválida e exclusão com falhas no servidor ou na limpeza local. Não substitui login Apple em aparelho.

Os testes remotos com contas descartáveis foram repetidos e passaram, incluindo exclusão dos dois buckets e da conta. TypeScript, lint e exportações iOS/Android passaram. Os testes de persistência/sync/avatar com shim: 28 passaram e 3 expectativas antigas falharam (campos opcionais do diário e `sunset`).

Após o erro nativo `enviar fotos da sala: A foto local não está disponível`, a adoção da foto passou a preservar o caminho original e recuperar arquivos pela versão nas pastas da conta/convidado. Caminhos antigos sob `Documents` são resolvidos contra a pasta atual do app. A migração dos quadros aproveita também `photoUri` quando a referência perdeu `localUri`. Upload e cache usam a mesma recuperação; foto inexistente continua pendente e pede nova escolha, sem confirmar um backup incompleto.

Os cinco testes de avatar passaram, incluindo recuperação de referência sem caminho, mudança da pasta de documentos e arquivo irrecuperável sem envio. As simulações de migração/upload de quadros e do provider passaram. Recuperação do arquivo específico no iPhone continua pendente.
