// Token broker for Google Calendar OAuth on the web (IF-3, NFR-5).
//
// Google's "Web application" clients require the client secret at the
// token endpoint even with PKCE. The secret must never ship in the
// browser bundle, so this function performs the exchange server-side.
// It can only exchange codes issued to this app's client id, and each
// code is bound to the caller's PKCE verifier and redirect URI.
//
// Deploy:  supabase functions deploy google-token
// Secret:  supabase secrets set GOOGLE_OAUTH_CLIENT_ID=… GOOGLE_OAUTH_CLIENT_SECRET=…

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return new Response('google-token function is not configured', { status: 500, headers: cors });
  }

  const body = await req.json();
  const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });

  if (body.grant_type === 'authorization_code') {
    params.set('grant_type', 'authorization_code');
    params.set('code', body.code);
    params.set('code_verifier', body.code_verifier);
    params.set('redirect_uri', body.redirect_uri);
  } else if (body.grant_type === 'refresh_token') {
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', body.refresh_token);
  } else {
    return new Response('unsupported grant_type', { status: 400, headers: cors });
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
