# Bookroom waitlist

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
