/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
// service-worker.js (static for Pages)

// Define the target URL that we want to intercept and proxy.
const TARGET_URL_PREFIX = 'https://generativelanguage.googleapis.com';

// Installation event:
self.addEventListener('install', (event) => {
  try {
    console.log('Service Worker: Installing...');
    event.waitUntil(self.skipWaiting());
  } catch (error) {
    console.error('Service Worker: Error during install event:', error);
  }
});

// Activation event:
self.addEventListener('activate', (event) => {
  try {
    console.log('Service Worker: Activating...');
    event.waitUntil(self.clients.claim());
  } catch (error) {
    console.error('Service Worker: Error during activate event:', error);
  }
});

// Fetch event:
self.addEventListener('fetch', (event) => {
  try {
    const requestUrl = event.request.url;

    if (requestUrl.startsWith(TARGET_URL_PREFIX)) {
      const safeReq = requestUrl.replace(/(key=)[^&]+/i, '$1REDACTED');
      console.log(`Service Worker: Intercepting request to ${safeReq}`);

      const remainingPathAndQuery = requestUrl.substring(TARGET_URL_PREFIX.length);
      const proxyUrl = `${self.location.origin}/api-proxy${remainingPathAndQuery}`;

      const safeProxy = proxyUrl.replace(/(key=)[^&]+/i, '$1REDACTED');
      console.log(`Service Worker: Proxying to ${safeProxy}`);

      const newHeaders = new Headers();
      const headersToCopy = [
        'Content-Type',
        'Accept',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        'X-Goog-Api-Key',
      ];

      for (const headerName of headersToCopy) {
        if (event.request.headers.has(headerName)) {
          newHeaders.set(headerName, event.request.headers.get(headerName));
        }
      }

      if (event.request.method === 'POST') {
        if (!newHeaders.has('Content-Type')) {
          console.warn('Service Worker: Missing Content-Type for POST. Defaulting to application/json.');
          newHeaders.set('Content-Type', 'application/json');
        }
      }

      const requestOptions = {
        method: event.request.method,
        headers: newHeaders,
        body: event.request.body,
        mode: event.request.mode,
        credentials: event.request.credentials,
        cache: event.request.cache,
        redirect: event.request.redirect,
        referrer: event.request.referrer,
        integrity: event.request.integrity,
      };

      if (event.request.method !== 'GET' && event.request.method !== 'HEAD' && event.request.body) {
        // @ts-ignore - duplex is non-standard but used by some runtimes
        requestOptions.duplex = 'half';
      }

      const promise = fetch(new Request(proxyUrl, requestOptions))
        .then((response) => {
          console.log(`Service Worker: Proxied ${safeProxy} -> Status ${response.status}`);
          return response;
        })
        .catch((error) => {
          console.error(`Service Worker: Proxy error to ${safeProxy}:`, error?.message || error);
          return new Response(
            JSON.stringify({ error: 'Proxying failed', details: error?.message || 'Unknown error' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
          );
        });

      event.respondWith(promise);
    } else {
      event.respondWith(fetch(event.request));
    }
  } catch (error) {
    console.error('Service Worker: Unhandled fetch error:', error);
    event.respondWith(
      new Response(
       JSON.stringify({ error: 'Service worker fetch handler failed', details: error?.message || 'Unknown' }),
       { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }
});

