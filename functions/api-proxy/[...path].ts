// Cloudflare Pages Functions: HTTP proxy for Google Generative Language API
// - Requires client-provided API key via header `X-Goog-Api-Key` or query `key`/`api_key`.
// - Streams responses through to the client.

export const onRequest: PagesFunction = async ({ request }) => {
  try {
    const reqUrl = new URL(request.url);

    // Handle WebSocket upgrade requests
    const upgrade = request.headers.get('Upgrade') || request.headers.get('upgrade');
    if (upgrade && upgrade.toLowerCase() === 'websocket') {
      // Resolve API key: header takes precedence, then query fallback.
      const headerKey = request.headers.get('x-goog-api-key') || request.headers.get('X-Goog-Api-Key');
      const search = new URLSearchParams(reqUrl.search);
      const queryKey = search.get('key') || search.get('api_key');
      const apiKey = headerKey || queryKey || '';
      if (!apiKey) {
        return new Response('Missing API key', { status: 401 });
      }

      // Build upstream WS URL; ensure key is present in query for upstream
      const pathAfter = reqUrl.pathname.replace(/^\/api-proxy\/?/, '');
      search.set('key', apiKey);
      const qs = search.toString();
      const upstreamWsUrl = `wss://generativelanguage.googleapis.com/${pathAfter}${qs ? `?${qs}` : ''}`;

      // Relay subprotocols if provided
      const subproto = request.headers.get('sec-websocket-protocol') || undefined;

      // Open connection to upstream
      const upstreamResp = await fetch(upstreamWsUrl, {
        headers: subproto ? { 'sec-websocket-protocol': subproto } : undefined,
      } as RequestInit);
      const upstreamSocket = (upstreamResp as any).webSocket as WebSocket | undefined;
      if (!upstreamSocket) {
        return new Response('Upstream refused WebSocket', { status: 502 });
      }
      upstreamSocket.accept();

      // Create a twin socket to return to client
      const pair = new WebSocketPair();
      const clientSocket = pair[0];
      const serverSocket = pair[1];
      serverSocket.accept();

      // Pipe messages both ways
      serverSocket.addEventListener('message', (evt: MessageEvent) => {
        try { upstreamSocket.send(evt.data); } catch { /* swallow */ }
      });
      upstreamSocket.addEventListener('message', (evt: MessageEvent) => {
        try { serverSocket.send(evt.data); } catch { /* swallow */ }
      });

      // Close both ends on either close/error
      const closeBoth = (code?: number, reason?: string) => {
        try { serverSocket.close(code, reason); } catch {}
        try { upstreamSocket.close(code, reason); } catch {}
      };
      serverSocket.addEventListener('close', (evt: CloseEvent) => closeBoth(evt.code, evt.reason));
      upstreamSocket.addEventListener('close', (evt: CloseEvent) => closeBoth(evt.code, evt.reason));
      serverSocket.addEventListener('error', () => closeBoth(1011, 'Client WebSocket error'));
      upstreamSocket.addEventListener('error', () => closeBoth(1011, 'Upstream WebSocket error'));

      // Return the socket to the client
      return new Response(null, { status: 101, webSocket: clientSocket });
    }

    // CORS preflight (mostly unnecessary for same-origin, but safe to handle)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': reqUrl.origin,
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Goog-Api-Key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Resolve API key: header takes precedence, then query fallback.
    const headerKey = request.headers.get('x-goog-api-key') || request.headers.get('X-Goog-Api-Key');
    const search = new URLSearchParams(reqUrl.search);
    const queryKey = search.get('key') || search.get('api_key');
    const apiKey = headerKey || queryKey || '';

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing API key', message: '클라이언트에서 API 키를 제공해야 합니다.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build upstream URL: strip `/api-proxy/` and drop key-like params
    const pathAfter = reqUrl.pathname.replace(/^\/api-proxy\/?/, '');
    search.delete('key');
    search.delete('api_key');
    const qs = search.toString();
    const upstreamUrl = `https://generativelanguage.googleapis.com/${pathAfter}${qs ? `?${qs}` : ''}`;

    // Prepare outbound headers (copy safe headers)
    const outboundHeaders = new Headers();
    const incoming = request.headers;
    const deny = new Set([
      'host', 'connection', 'content-length', 'transfer-encoding', 'upgrade',
      'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-extensions',
      'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'x-forwarded-for',
    ]);

    for (const [name, value] of incoming.entries()) {
      if (!deny.has(name.toLowerCase())) {
        outboundHeaders.set(name, value);
      }
    }

    // Always set client-provided API key header
    outboundHeaders.set('X-Goog-Api-Key', apiKey);

    // For GET/DELETE, do not forward a body
    const method = request.method.toUpperCase();
    const init: RequestInit = {
      method,
      headers: outboundHeaders,
      // body will be attached only for methods that can carry a body
    };
    if (!['GET', 'HEAD', 'DELETE'].includes(method)) {
      // Cloudflare allows streaming request bodies
      init.body = request.body;
    }

    const upstreamResp = await fetch(upstreamUrl, init);

    // Pass-through status and headers, streaming body
    const respHeaders = new Headers(upstreamResp.headers);
    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      headers: respHeaders,
    });
  } catch (err: any) {
    // Do not leak sensitive details
    return new Response(JSON.stringify({ error: 'Proxy error', message: '업스트림 프록시 처리 중 오류가 발생했습니다.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
