export function requireAccount(env) {
  return async (req, res, next) => {
    if (!/^\/api\/(?:anthropic|applications|analyze-sketch|parse-document)(?:\/|\?|$)/.test(req.url || '')) return next();
    const url = env.VITE_SUPABASE_URL;
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const token = req.headers.authorization;
    let code = !url || !key ? 503 : 401;
    if (code === 401 && /^Bearer \S+$/.test(token || '')) {
      try {
        const response = await fetch(new URL('/auth/v1/user', url), {
          headers: { apikey: key, authorization: token }, signal: AbortSignal.timeout(8000),
        });
        if (response.ok && (await response.json()).id) return next();
        if (response.status >= 500) code = 503;
      } catch { code = 503; }
    }
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: code === 401 ? 'Sign in to use this feature.' : 'Account service is unavailable.' }));
  };
}

