const jsonHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": origin || "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  Vary: "Origin",
});

const response = (
  body: Record<string, string>,
  status: number,
  origin: string | null,
) => new Response(JSON.stringify(body), { status, headers: jsonHeaders(origin) });

Deno.serve((request) => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders(origin) });
  }

  if (request.method === "GET" || request.method === "POST") {
    return response({ error: "waitlist_closed" }, 410, origin);
  }

  return response({ error: "method_not_allowed" }, 405, origin);
});
