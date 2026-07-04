// Stateless CalDAV proxy for the web build (browser CORS blocks direct
// caldav.icloud.com requests). Forwards the request and returns the
// response; credentials pass through TLS and are never stored (NFR-5).
// Deploy with: supabase functions deploy caldav-proxy

const ALLOWED_HOSTS = new Set(['caldav.icloud.com']);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const { url, method, headers, body } = await req.json();
  const target = new URL(url);
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return new Response('Host not allowed', { status: 403, headers: cors });
  }

  const res = await fetch(url, { method, headers, body: body ?? undefined });
  const text = await res.text();
  const outHeaders: Record<string, string> = {};
  res.headers.forEach((v: string, k: string) => (outHeaders[k] = v));

  return new Response(JSON.stringify({ status: res.status, text, headers: outHeaders }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
