// Claude proxy. When Supabase is configured (SUPABASE_URL + SUPABASE_ANON_KEY),
// the coach requires a signed-in user: the bearer token is verified against
// Supabase's auth server — works with legacy AND new JWT signing keys.
// ANTHROPIC_API_KEY never reaches the client.

async function verifyUser(token) {
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: true, open: true };           // cloud not configured → open mode
  if (!token) return { ok: false };
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: anon }
    });
    if (!r.ok) return { ok: false };
    const u = await r.json();
    return u && u.id ? { ok: true, userId: u.id } : { ok: false };
  } catch (e) { return { ok: false }; }
}

exports.handler = async (event) => {
  const authRequired = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
  if (event.httpMethod === 'GET') {
    const base = { ok: true, keySet: !!process.env.ANTHROPIC_API_KEY, authRequired };
    const deep = event.queryStringParameters && event.queryStringParameters.check;
    if (!deep) return { statusCode: 200, body: JSON.stringify(base) };
    // Deep check: verify the key against Anthropic with a ~1-token probe.
    // Sign-in required (when auth is configured) so strangers can't spend tokens.
    if (authRequired) {
      const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      const v = await verifyUser(token);
      if (!v.ok) return { statusCode: 401, body: JSON.stringify({ ...base, error: 'sign in to run the check' }) };
    }
    if (!base.keySet) return { statusCode: 200, body: JSON.stringify({ ...base, upstream: { status: 0, error: 'ANTHROPIC_API_KEY not set' } }) };
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] })
      });
      const text = await r.text();
      let msg = null; try { const j = JSON.parse(text); msg = (j.error && j.error.message) || null; } catch (e) {}
      return { statusCode: 200, body: JSON.stringify({ ...base, upstream: { status: r.status, error: msg } }) };
    } catch (e) {
      return { statusCode: 200, body: JSON.stringify({ ...base, upstream: { status: 0, error: 'could not reach Anthropic' } }) };
    }
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!process.env.ANTHROPIC_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) };

  if (authRequired) {
    const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const v = await verifyUser(token);
    if (!v.ok) return { statusCode: 401, body: JSON.stringify({ error: 'sign in to use the coach' }) };
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: event.body
    });
    const text = await r.text();
    return { statusCode: r.status, headers: { 'Content-Type': 'application/json' }, body: text };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'upstream failed' }) };
  }
};
