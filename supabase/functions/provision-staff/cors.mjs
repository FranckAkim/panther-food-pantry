const allowedHeaders = ['authorization', 'apikey', 'content-type', 'x-client-info'];

export function withCors(handler, origins = []) {
  for (const origin of origins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error('CORS origins must be exact HTTP(S) origins');
    }
  }
  const allowlist = new Set(origins);
  return async request => {
    const origin = request.headers.get('origin');
    const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
    const reply = (status, error) => new Response(JSON.stringify({ error }), {
      status, headers: { ...Object.fromEntries(headers), 'Content-Type': 'application/json' },
    });
    if (origin !== null && !allowlist.has(origin)) return reply(403, 'Origin is not allowed');
    if (origin !== null) headers.set('Access-Control-Allow-Origin', origin);
    if (request.method === 'OPTIONS') {
      const requested = (request.headers.get('access-control-request-headers') || '')
        .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
      if (!origin || request.headers.get('access-control-request-method') !== 'POST' ||
          requested.some(value => !allowedHeaders.includes(value))) {
        return reply(403, 'Preflight is not allowed');
      }
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      return new Response(null, { status: 204, headers });
    }
    try {
      const response = await handler(request);
      const merged = new Headers(response.headers);
      for (const [name, value] of headers) merged.set(name, value);
      return new Response(response.body, { status: response.status, headers: merged });
    } catch {
      return reply(503, 'Account service unavailable');
    }
  };
}
