// Lightweight key validation against our same-origin proxy.
// Returns only status truthiness to avoid exposing details.
export async function validateApiKey(apiKey: string, opts?: { signal?: AbortSignal; timeoutMs?: number }): Promise<{ ok: boolean; status: number }>{
  const controller = new AbortController();
  const signal = mergeAbortSignals(opts?.signal, controller.signal);
  let timeoutId: any;
  try {
    if (opts?.timeoutMs && opts.timeoutMs > 0) {
      timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);
    }
    const resp = await fetch('/api-proxy/v1beta/models', {
      method: 'GET',
      headers: { 'X-Goog-Api-Key': apiKey },
      signal,
    });
    return { ok: resp.ok, status: resp.status };
  } catch {
    // Network/abort errors: treat as failure with status 0
    return { ok: false, status: 0 };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function mergeAbortSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (a.aborted || b.aborted) {
    controller.abort();
  } else {
    a.addEventListener('abort', onAbort);
    b.addEventListener('abort', onAbort);
  }
  return controller.signal;
}

