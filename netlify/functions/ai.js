// Claude proxy. If SUPABASE_JWT_SECRET is set, requires a valid signed-in user (JWT);
// otherwise stays open (pre-accounts mode). ANTHROPIC_API_KEY never reaches the client.
const crypto = require('crypto');

function verifyJwt(token, secret) {
  try {
    const [h, p, sig] = token.split('.');
    if (!h || !p || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, body: JSON.stringify({ ok: true, keySet: !!process.env.ANTHROPIC_API_KEY, authRequired: !!process.env.SUPABASE_JWT_SECRET }) };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!process.env.ANTHROPIC_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) };

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (secret) {
    const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = token ? verifyJwt(token, secret) : null;
    if (!payload || !payload.sub) return { statusCode: 401, body: JSON.stringify({ error: 'sign in to use the coach' }) };
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
