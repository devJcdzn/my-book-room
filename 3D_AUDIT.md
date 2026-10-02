# Auditoria de memória e renderização 3D

Data: 01/10/2026. Expo SDK 57, React Three Fiber 9.7 e Three.js 0.185. Alterações limitadas ao ciclo de vida e à renderização da sala, sem novas dependências ou migrações.

## Resultado dos oito candidatos

| Candidato | Evidência e ação |
| --- | --- |
| 1. Vazamento no Three.js/R3F | Confirmado na retenção de renderizadores pelos recursos GLTF compartilhados: depois de 30 remontagens, geometrias, material e textura do gato tinham 31 callbacks de `dispose`. Agora os recursos têm contagem de consumidores e liberam alocações de GPU/listeners quando o último sai. Os dados dos modelos continuam reutilizáveis no cache. |
| 2. Vários `requestAnimationFrame` | Nenhuma chamada direta no código do app. O R3F gerencia o loop global. Não foi identificado um loop próprio duplicado. A sala continuava renderizando quando oculta; agora pausa por foco e `AppState`. |
| 3. Efeitos recriando objetos | Não foi encontrado crescimento infinito por efeitos. Os móveis recriavam clones e materiais por mudanças de paletas que não afetavam sua categoria. As dependências agora usam apenas as cores relevantes. |
| 4. Recursos sem `dispose` | Confirmado nos três caches de imagens, nos resultados tardios de cargas canceladas e nas geometrias externas da janela. Corrigidos com hook compartilhado de imagens e cleanup das geometrias. O descarte compartilhado dos GLTFs e da máscara de sombra também evita reter renderizadores antigos. |
| 5. Listeners repetidos | Os listeners de GPU ligados aos recursos GLTF acumulavam por remontagem. Corrigidos pelo descarte após o último consumidor. Os listeners de foco/AppState e o BackHandler do editor têm cleanup; não foi encontrado registro permanente repetido nesses fluxos. |
| 6. Estado React no loop | Os callbacks de prontidão e conclusão já têm guardas para disparar uma vez. Animações atualizam refs/objetos, sem `setState` a cada frame. A conclusão agora acumula `delta`, pois o R3F zera o relógio ao trocar `frameloop`; assim a pausa não invalida seu progresso. |
| 7. Objetos adicionados por render | Não há `scene.add()` no app. A árvore é declarativa. O gato agora clona a hierarquia, evitando anexar diretamente a mesma cena GLTF em diferentes montagens. |
| 8. Recursos antigos após refresh | O vazamento de callbacks por remontagem explica retenção mesmo quando existe apenas um contexto GL registrado. O R3F desmonta sua raiz e o GLView nativo destrói o contexto; não foi acrescentada destruição manual. A rodada de 30 ciclos foi feita sem Fast Refresh. Reload completo foi exercitado; a repetição com Fast Refresh permanece pendente, a ativação do hot reload e duas alterações temporárias foram tentadas em uma sessão separada, mas o inspector não respondeu após a recarga. Não há medição suficiente para aprovar esse cenário. |

## Propriedade dos recursos

- Geometrias/materiais declarados em JSX: descarte pelo R3F.
- Geometrias passadas como props à janela: cleanup explícito do componente.
- Materiais clonados dos móveis: cleanup existente por instância.
- Geometrias, materiais e texturas dos modelos GLTF, e máscara de sombra: compartilhados enquanto há consumidores. `dispose()` libera a parte de GPU, sem apagar os arrays/imagens usados em novas montagens.
- Capas, pôsteres e fotos: uma carga por URL com consumidores simultâneos; sem retenção após a última saída. Resultados tardios são descartados. O hook lê a URL atual via `useSyncExternalStore`, sem conservar a imagem anterior no estado React.

## Verificação local

Typecheck e lint dos arquivos alterados passaram, assim como `git diff --check`. A suíte completa terminou com 98 testes: 94 passaram e quatro falharam. Os oito testes adicionados passaram.

Os testes novos cobrem carga simultânea, descarte após o último consumidor, troca/remoção de URL, falha, resultados tardios, dados GLTF reutilizáveis e 30 ciclos sem acumular callbacks de renderizador. Há também um teste garantindo que o cleanup de um capturador antigo não apague o novo após remontagem. A câmera e a iluminação de captura são restauradas em `finally` quando a operação termina, incluindo falhas.

A suíte anterior já tinha quatro falhas, reproduzidas com os arquivos da sala anteriores às mudanças:

- Dois testes de persistência da biblioteca.
- Um teste de sincronização do diário.
- Um teste de resolução de personalização premium.

O lint global também tem uma falha anterior em `app/reading-timer.tsx:109`, por atualização síncrona de estado em um efeito. Esses arquivos ficaram fora das alterações.

## Evidência de execução

iPhone 17 Pro Simulator, iOS 26.2, development client instalado, com o JavaScript do checkout atual. Diagnóstico temporário, sem painel permanente. Os ciclos usam navegação real e alterações no rascunho do editor, sem salvar mudanças na biblioteca.

- Antes da pausa por foco: 686 frames em 11,431 segundos na aba Biblioteca, aproximadamente 60 frames/s.
- Depois: zero frames em 26,217 segundos, com `frameloop="never"` na Biblioteca.
- Sala estabilizada: 121 objetos, 69 geometrias e 3 texturas. Programas variam conforme os materiais ativos e seu descarte.
- Primeira rodada de três blocos de dez ciclos: alternar abas, abrir/fechar editor, alternar acabamentos, duas imagens locais, três gatos e remontar o Canvas. Concluiu sem erro do roteiro, mas revelou os 31 callbacks antigos por recurso compartilhado.

- Rodada final após o descarte compartilhado: três blocos de dez ciclos concluídos, sem erro do roteiro. Em 100 amostras, o máximo de callbacks de descarte foi 1 por geometria/material/textura, em vez de 31. Uma raiz R3F e um contexto registrados ao final.
- Após cada bloco: retorno a 121 objetos, 69 geometrias, 3 texturas e 6 programas. Durante a edição houve crescimento temporário (até 141 objetos, 81 geometrias e 4 texturas), sem crescimento persistente entre blocos com o mesmo conjunto de recursos.
- RSS do processo variou durante a rodada; a amostra final foi 430.976 KiB. Não foi calculada uma redução percentual de memória, pois o RSS inclui cache, aquecimento e overhead do simulador.
- Carga lenta, falha, troca antes da conclusão e resultado tardio foram exercitados deterministicamente com loader controlado nos testes. A rodada nativa alternou duas imagens locais; não equivale a uma validação de rede lenta no aparelho.
- Compartilhamento: modal e troca de temas disponíveis, mas a chamada nativa `GLView.takeSnapshotAsync` ficou pendente no simulador, sem URI retornada. Captura dia/noite e compartilhamento completos não estão aprovados por essa execução. O cliente foi reiniciado após essa tentativa.

Contagens da cena e de contextos, isoladamente, não comprovam ausência de vazamento: a primeira rodada tinha uma raiz/contexto ativo e ainda retinha callbacks antigos. RSS do simulador é apenas evidência complementar; não é uma medição isolada da memória GPU.

## Pendências

Nenhum iPhone físico foi detectado. A confirmação de memória, fluidez e comportamento do driver em aparelho físico permanece pendente; o simulador não substitui essa etapa.

Também permanecem pendentes a rodada específica de Fast Refresh, a conclusão de livro com pausa/retorno e o ciclo completo de segundo plano/retorno. A pausa por navegação entre abas foi medida; o controle por AppState foi revisado no código. A restauração da câmera e a geração dos snapshots devem ser confirmadas quando a captura nativa estiver operacional.

Referências verificadas: [Expo SDK 57 — GLView](https://docs.expo.dev/versions/v57.0.0/sdk/gl-view/), implementação instalada do R3F 9.7 e do GLView nativo. Não houve alterações de dados persistidos, dependências ou visual. Diagnóstico e roteiro temporários foram removidos do código.
