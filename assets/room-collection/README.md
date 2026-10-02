# Bookroom — coleção de leitura

24 modelos originais, em Natural claro, Biblioteca clássica e Botânico. Cada coleção contém mesa, assento, estante, luminária, janela, moldura, tapete e planta.

- `bookroom-collection.blend`: mestre editável; as cenas `natural Room`, `classic Room` e `botanic Room` apresentam composições com a câmera do app. As coleções individuais ficam na cena `Bookroom Collection`.
- `<coleção>-<categoria>.glb`: modelos locais com materiais PBR e geometria embutida, sem dependências externas, Draco ou extensões de compressão.
- `<coleção>-<categoria>.png`: miniaturas reais renderizadas no Blender.
- `<coleção>-room-day.png` e `*-night.png`: estudos de composição; o céu da janela, fotos, livros e gato são adicionados pelo app.
- `manifest.json`: dimensões no Blender, número de triângulos e tamanho dos GLBs.

O app usa Y para cima; o Blender usa Z. A exportação faz essa conversão. Móveis têm origem no piso; janela e moldura no centro da peça com a frente em +Z no app. Estantes compartilham as alturas das prateleiras (0,215; 1,035; 1,855; 2,675), e mesas têm tampo a 1,15. Materiais terminam em `_wood`, `_fabric`, `_ceramic`, `_leaf`, `_paper`, `_metal` ou `_soil`; o app clona materiais para personalizar cada instância.

Para reconstruir, a partir da raiz do projeto:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/build-room-assets.py
```

No app: Personalizar quarto → Móveis e disposição → Modelos. Escolha peça, modelo e acabamento; volte a Posicionar para arrastar. Salvar persiste a disposição; Cancelar descarta o rascunho. Fotos permanecem no aparelho e não entram no backup de nuvem.

Validação automatizada: `npx tsx --test tests/room-layout.test.ts` (9 testes). Os maiores modelos têm 12.660 triângulos e 361.304 bytes, abaixo do orçamento inicial.

TypeScript, lint e exportação iOS/Android passam. A suíte completa tem quatro falhas anteriores a esta sprint, em persistência, sincronização e acesso premium. A revisão visual e de gestos no aparelho, com oito decorações adicionais, continua necessária: o simulador carregou os GLBs, mas a renderização OpenGL ficou bloqueada, impedindo comprovar a sala completa e o desempenho nativo. As imagens desta pasta são renders do Blender, não capturas do app.
