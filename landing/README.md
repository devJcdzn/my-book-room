# Bookroom waitlist

Landing page estática, sem build step. Para testar localmente:

```bash
python3 -m http.server 4173 --directory landing
```

Antes de publicar, edite `config.js` com a URL pública da função e a site key do Turnstile. A URL e a site key são valores públicos; não coloque o secret do Turnstile nem o webhook do Discord nesse arquivo.

No Supabase:

```bash
npx supabase db push
npx supabase functions deploy testflight-waitlist
npx supabase secrets set \
  TURNSTILE_SECRET_KEY=... \
  DISCORD_WAITLIST_WEBHOOK_URL=... \
  WAITLIST_ALLOWED_ORIGINS=https://seu-dominio.com,http://127.0.0.1:4173
```

O canal do Discord usado pelo webhook deve ser privado. A função mantém a inscrição mesmo quando a notificação falha, permitindo recuperação pelo campo `discord_notified_at`.
