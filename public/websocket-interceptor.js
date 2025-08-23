(function() {
  const TARGET_WS_HOST = 'generativelanguage.googleapis.com';
  const originalWebSocket = window.WebSocket;

  if (!originalWebSocket) {
    console.error('[WebSocketInterceptor] window.WebSocket not found.');
    return;
  }

  const handler = {
    construct(target, args) {
      let [url, protocols] = args;
      let newUrlString = typeof url === 'string' ? url : (url && typeof url.toString === 'function' ? url.toString() : null);
      let isTarget = false;

      if (newUrlString) {
        try {
          if (newUrlString.startsWith('ws://') || newUrlString.startsWith('wss://')) {
            const parsedUrl = new URL(newUrlString);
            if (parsedUrl.host === TARGET_WS_HOST) {
              isTarget = true;
              const proxyScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
              const proxyHost = window.location.host;
              newUrlString = `${proxyScheme}://${proxyHost}/api-proxy${parsedUrl.pathname}${parsedUrl.search}`;
            }
          }
        } catch (e) {
          console.warn('[WebSocketInterceptor] Error parsing WebSocket URL:', e);
        }
      }

      if (isTarget) {
        console.log('[WebSocketInterceptor] Redirecting WebSocket to local proxy.');
      }

      if (protocols) {
        return Reflect.construct(target, [newUrlString, protocols]);
      } else {
        return Reflect.construct(target, [newUrlString]);
      }
    },
    get(target, prop, receiver) {
      if (prop === 'prototype') {
        return target.prototype;
      }
      return Reflect.get(target, prop, receiver);
    }
  };

  window.WebSocket = new Proxy(originalWebSocket, handler);
  console.log('[WebSocketInterceptor] WebSocket constructor wrapped.');
})();

