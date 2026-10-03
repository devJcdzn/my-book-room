# Nookly — landing e TestFlight

Landing page estática, sem build step. Para testar localmente:

```bash
python3 -m http.server 4173 --directory landing
```

O `config.js` aponta para a função pública do projeto Bookroom. O Turnstile é opcional: para ativá-lo, configure a site key pública no arquivo e o secret apenas na função. Nunca coloque o secret do Turnstile nem o webhook do Discord no código da landing.

No Supabase:

```bash
npx supabase db push
npx supabase functions deploy testflight-waitlist
npx supabase secrets set \
  DISCORD_WAITLIST_WEBHOOK_URL=...
```

`WAITLIST_ALLOWED_ORIGINS` é opcional. Se for usado, inclua todos os domínios de produção, preview e desenvolvimento separados por vírgula; uma origem ausente recebe HTTP 403. Sem esse secret, a função aceita qualquer origem web. Use o Turnstile para proteção anti-spam.

Configuração atual:

```bash
npx supabase secrets set \
  WAITLIST_ALLOWED_ORIGINS=https://testmybookroom.netlify.app,http://127.0.0.1:4173,http://localhost:4173
```

Para ativar o Turnstile depois:

```bash
npx supabase secrets set TURNSTILE_SECRET_KEY=...
```

O canal do Discord usado pelo webhook deve ser privado. A função mantém a inscrição mesmo quando a notificação falha, permitindo recuperação pelo campo `discord_notified_at`.

## Identidade e imagens

Paleta do app: creme, sálvia e terracota. Ícone e Niko vêm de `assets/` do projeto. Os arquivos `*-iphone.webp` foram exportados dos mockups com telas reais do arquivo Figma BJ-Screenshots (página 0:1, nós 4054:26, 4054:54, 4054:82 e 4054:110). Para atualizar as telas, exporte esses mockups novamente e substitua as imagens. A fonte Playfair Display é servida localmente.

A página mantém o endpoint existente e o cadastro do TestFlight. O nome interno `BOOKROOM_CONFIG` foi preservado para compatibilidade. Termos, privacidade e suporte descrevem o login opcional, a sincronização e a ausência de compras na versão atual.
