// Public client config from environment — no secrets in the repo.
// SUPABASE_ANON_KEY is safe to expose: Row Level Security is the actual gate.
exports.handler = async () => {
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) return { statusCode: 404, body: JSON.stringify({ error: 'cloud not configured' }) };
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }, body: JSON.stringify({ url, anonKey }) };
};
