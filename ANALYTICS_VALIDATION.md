# Himetrica — implementação e validação

Atualizado em 03/10/2026.

## Configuração

- SDK `@himetrica/tracker-react-native@0.1.29`; AsyncStorage `2.2.0`, compatível com Expo SDK 57.
- Produção EAS: chave pública configurada como variável `sensitive` e `EXPO_PUBLIC_ENABLE_ANALYTICS=true`. A chave é pública no bundle; não é uma credencial administrativa.
- Desenvolvimento local, flag ausente/desativada ou chave ausente: provider não é instanciado e ações de analytics são inertes.
- O perfil EAS `production` atende App Store/TestFlight. Não há captura automática de console, publicidade ou outro container de navegação.
- Identificação e reset são serializados; um marcador local da última conta protege também mudanças de conta entre reinícios. Eventos antigos são descartados ao desconectar o provider.
- Convidado → primeiro login mantém o visitante para medir o funil. Logout/exclusão e troca direta de conta reiniciam o visitante. Sessão restaurada e retorno ao primeiro plano repetem a identificação, sem emitir novo login.
- A fila e as sessões são do SDK. Seu transporte descarta eventos após esgotar tentativas (retryCount até 3); analytics não é um mecanismo de entrega garantida.
- O SDK 0.1.29 inicia em um efeito do provider. Compartilhamos sua promessa pública de inicialização para evitar identificação prematura e inicialização concorrente.

## Dados enviados

Telas usam segmentos do Expo Router, sem query string ou valores de parâmetros. Eventos aceitam somente propriedades permitidas por evento, além de `platform`, `app_version` e `user_type` (`guest`/`connected`).

| Evento | Propriedades específicas |
| --- | --- |
| onboarding_started | version |
| onboarding_completed / onboarding_skipped | final_step |
| login_started / login_succeeded / login_cancelled | provider |
| login_failed | provider, failure_category |
| book_added | source (catalog/manual), status |
| book_completed | nenhuma |
| reading_session_saved | duration_seconds, pages_read |
| reading_note_created | nenhuma |
| room_customization_saved | piece_count |
| profile_updated | photo_changed |
| account_signed_out / account_deleted | nenhuma |

Identificação: ID Supabase, nome disponível, email disponível, metadados `provider` e `created_at` disponíveis. SDK: identificadores de visitante/sessão, versão do sistema, dimensões da tela e duração de navegação. Não usamos IDFA ou localização.

Não enviamos títulos, autores, buscas, notas, resenhas, bio, imagens, tokens ou URLs de arquivos. Restaurar backups não dispara eventos de edição. Exemplos de timer e nota do onboarding não são sessões/notas reais.

## Privacidade na App Store

Esta tabela documenta a contribuição desta integração; a declaração completa também deve incluir Supabase e os demais serviços do app.

| Categoria Apple | Dado | Finalidade | Vinculado ao usuário |
| --- | --- | --- | --- |
| Contact Info → Name | nome de perfil disponível | Analytics | sim, após login |
| Contact Info → Email Address | email da conta disponível | Analytics | sim |
| Identifiers → User ID | ID Supabase e sessão associada à conta | Analytics | sim |
| Identifiers → Device ID | identificador aleatório persistente da instalação/visitante | Analytics | sim, quando identificado |
| Location → Coarse Location | país, região e cidade estimados pelo fornecedor a partir do IP | Analytics | sim, quando identificado |
| Usage Data → Product Interaction | telas, ações, frequência, duração, páginas por sessão | Analytics | sim, quando identificado |

O identificador aleatório representa a instalação/visitante, sem ler um identificador de hardware ou publicitário. A política do fornecedor informa estimativa de país/região/cidade pelo IP, sem retê-lo na base de analytics após resolução. Incluímos localização aproximada na documentação; confirmar o tratamento do endpoint React Native com o fornecedor antes da declaração final. Não marcar dados como anônimos quando associados a uma conta. Tracking entre apps/sites não é implementado nesta integração; confirmar os usos do fornecedor antes de concluir a declaração. SDK não fornece exclusão remota via `reset()`; pedidos de exclusão dos registros existentes precisam ser atendidos no serviço.

Referências: https://developer.apple.com/app-store/app-privacy-details/ e https://www.himetrica.com/privacy

Política local atualizada em `landing/privacy.html`; publicação da landing e preenchimento da declaração no App Store Connect não foram feitos nesta tarefa.

## Evidência e pendências

- TypeScript e lint: aprovados.
- Três testes do serviço aprovados: rotas sem parâmetros/duplicação, lista permitida de propriedades, coleta desconectada, identificação, reset, troca de contas, respostas/conexões antigas e falha de reset.
- Ações reais do store exercitadas no harness: início/conclusão de onboarding, inclusão manual, nota, sessão e conclusão de livro emitiram uma vez; ações inválidas/repetidas e restauração do snapshot não emitiram; conteúdo privado ausente dos payloads.
- SDK real 0.1.29 exercitado em harness temporário com armazenamento nativo e rede simulados: persistência offline, reenvio posterior, identificação e reset do visitante aprovados. Isso não comprova funcionamento no aparelho.
- Suíte anterior reproduzida em cópia de HEAD: 32 passaram, 8 falharam. Mesmas falhas na suíte atual antes dos testes novos: library-persistence, library-sync, onboarding, open-library, reading-session, room-customization-access (resolver premium), room-customization, room-layout. Falhas preexistentes ao executar dependências React Native no Node (`Unexpected typeof`), incluindo o resolver premium que também depende desses módulos. Não alteramos a infraestrutura de testes fora do escopo.
- Suíte final: 35 aprovados (incluindo 3 novos testes de analytics), mesmas 8 falhas anteriores.
- Exportações iOS e Android: aprovadas; reexecução final aprovada.
- Painel do projeto Nookly acessível, porém informa: “Este projeto não recebe dados” e “Sem assinatura, quem entra no site não é registrado”. Confirmação de ingestão/identificação remota bloqueada por assinatura inativa.
- Pendentes no aparelho: login Apple real e cancelamento; sessão restaurada; logout; troca/exclusão de conta; offline/reabertura; todos os eventos do funil; instalação do novo binário com AsyncStorage. Sem alterações na conta real ou exclusão de dados de usuários para testar.
- Logs nativos do build confirmam autolinking e instalação de `RNCAsyncStorage (2.2.0)` e cópia de seu `PrivacyInfo.xcprivacy`. Build iOS concluído com sucesso no EAS.
- Novo build iOS de produção concluído: https://expo.dev/accounts/devjc/projects/my-book-room/builds/9cbfb6de-0413-4e77-aa66-557870cda7d1 . Versão 1.1.3 (12); status EAS FINISHED (03/10/2026, 21:45:50 UTC). Não foi submetido automaticamente ao TestFlight. Não é uma correção comprovada da indisponibilidade da compilação 10 no TestFlight.
