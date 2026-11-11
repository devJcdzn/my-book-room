import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set(
  (Deno.env.get('USERNAME_RESERVATION_ALLOWED_ORIGINS') || [
    'https://www.nooklyapp.site',
    'https://nooklyapp.site',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ].join(','))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
);

const headersFor = (origin: string | null) => ({
  'Access-Control-Allow-Headers': 'apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  Vary: 'Origin',
});

const respond = (body: Record<string, unknown>, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: headersFor(origin) });

const usernamePattern = /^[a-z0-9_]{3,20}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  const originIsAllowed = !origin || allowedOrigins.has(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: originIsAllowed ? 204 : 403, headers: headersFor(origin) });
  }
  if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405, origin);
  if (!originIsAllowed) return respond({ error: 'origin_not_allowed' }, 403, origin);

  let body: { action?: unknown; email?: unknown; username?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return respond({ error: 'invalid_request' }, 400, origin);
    }
    body = parsed as typeof body;
  } catch {
    return respond({ error: 'invalid_request' }, 400, origin);
  }

  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!usernamePattern.test(username)) return respond({ error: 'invalid_username' }, 400, origin);

  if (body.action !== 'check' && body.action !== 'reserve') {
    return respond({ error: 'invalid_action' }, 400, origin);
  }

  let email = '';
  if (body.action === 'reserve') {
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !emailPattern.test(email)) {
      return respond({ error: 'invalid_email' }, 400, origin);
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return respond({ error: 'server_unavailable' }, 500, origin);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (body.action === 'check') {
    const { data, error } = await admin
      .from('username_reservations')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (error) return respond({ error: 'server_unavailable' }, 500, origin);
    return respond({ available: !data }, 200, origin);
  }

  const { error } = await admin.from('username_reservations').insert({ email, username });
  if (!error) return respond({ status: 'reserved' }, 201, origin);

  if (error.code === '23505') {
    const { data: emailReservation, error: lookupError } = await admin
      .from('username_reservations')
      .select('username')
      .eq('email', email)
      .maybeSingle();

    if (lookupError) return respond({ error: 'server_unavailable' }, 500, origin);
    if (emailReservation?.username === username) return respond({ status: 'reserved' }, 200, origin);
    if (emailReservation) return respond({ error: 'email_already_reserved' }, 409, origin);
    return respond({ error: 'username_taken' }, 409, origin);
  }

  return respond({ error: 'server_unavailable' }, 500, origin);
});
