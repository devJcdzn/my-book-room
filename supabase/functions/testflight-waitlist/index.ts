import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOTAL_SLOTS = 200;
const allowedOrigins = (Deno.env.get("WAITLIST_ALLOWED_ORIGINS") || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const jsonHeaders = (origin: string | null) => {
  const allowedOrigin = origin && allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] || "*";

  return {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
};

const response = (
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders(origin) });

const originAllowed = (origin: string | null) => {
  if (!origin) return true;
  return allowedOrigins.length === 0 || allowedOrigins.includes(origin);
};

const isEmail = (email: string) =>
  email.length >= 3 &&
  email.length <= 320 &&
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const verifyTurnstile = async (token: string, request: Request) => {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret || !token) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const form = new URLSearchParams({
      secret,
      response: token,
    });
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) form.set("remoteip", forwardedFor.split(",")[0].trim());

    const result = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: form,
        signal: controller.signal,
      },
    );
    if (!result.ok) return false;

    const payload = await result.json();
    return payload.success === true;
  } catch (_error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const notifyDiscord = async (
  email: string,
  position: number,
  remaining: number,
) => {
  const webhook = Deno.env.get("DISCORD_WAITLIST_WEBHOOK_URL");
  if (!webhook) return false;

  const body = JSON.stringify({
    allowed_mentions: { parse: [] },
    content: [
      "📚 Nova inscrição na waitlist do Bookroom",
      `Email Apple: ${email}`,
      `Posição: ${position}/${TOTAL_SLOTS}`,
      `Vagas restantes: ${remaining}`,
      `Recebida em: ${new Date().toISOString()}`,
    ].join("\n"),
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const result = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      if (result.ok) return true;
    } catch (_error) {
      // The signup remains valid even if the operator notification is unavailable.
    } finally {
      clearTimeout(timeout);
    }

    if (attempt === 0) await wait(500);
  }

  return false;
};

const getServiceClient = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const getAvailability = async (client: ReturnType<typeof getServiceClient>) => {
  const { count, error } = await client
    .from("testflight_waitlist")
    .select("id", { count: "exact", head: true });
  if (error) throw error;

  const total = Math.min(TOTAL_SLOTS, count || 0);
  return {
    total: TOTAL_SLOTS,
    remaining: Math.max(0, TOTAL_SLOTS - total),
    full: total >= TOTAL_SLOTS,
  };
};

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");

  if (!originAllowed(origin)) {
    return response({ error: "origin_not_allowed" }, 403, origin);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders(origin) });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return response({ error: "method_not_allowed" }, 405, origin);
  }

  try {
    const client = getServiceClient();

    if (request.method === "GET") {
      return response(await getAvailability(client), 200, origin);
    }

    const payload = await request.json().catch(() => null);
    const email = typeof payload?.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";
    const turnstileToken = typeof payload?.turnstileToken === "string"
      ? payload.turnstileToken
      : "";
    const honeypot = typeof payload?.company === "string"
      ? payload.company
      : "";

    if (honeypot || !isEmail(email)) {
      return response({ error: "invalid_email" }, 400, origin);
    }

    if (!(await verifyTurnstile(turnstileToken, request))) {
      return response({ error: "turnstile_failed" }, 403, origin);
    }

    const { data, error } = await client.rpc("join_testflight_waitlist", {
      p_email: email,
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || !["joined", "duplicate", "full"].includes(result.status)) {
      throw new Error("WAITLIST_RESULT_INVALID");
    }

    if (result.status === "full") {
      return response({ status: "full", remaining: 0 }, 409, origin);
    }

    if (result.status === "joined") {
      const notified = await notifyDiscord(
        email,
        result.position,
        result.remaining,
      );
      if (notified) {
        await client
          .from("testflight_waitlist")
          .update({ discord_notified_at: new Date().toISOString() })
          .eq("email_normalized", email);
      } else {
        console.error("waitlist_discord_notification_failed");
      }
    }

    return response(
      {
        status: result.status,
        remaining: result.remaining,
      },
      200,
      origin,
    );
  } catch (error) {
    console.error(
      "waitlist_request_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return response({ error: "waitlist_unavailable" }, 503, origin);
  }
});
