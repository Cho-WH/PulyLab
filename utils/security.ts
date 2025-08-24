export function maskKey(key: string, visible: number = 4): string {
  if (!key) return '';
  const keep = Math.max(0, Math.min(visible, key.length));
  const head = key.slice(0, keep);
  return `${head}${'*'.repeat(Math.max(0, key.length - keep))}`;
}

export function sanitizeUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url, window.location?.origin || 'http://local');
    if (u.searchParams.has('key')) u.searchParams.set('key', 'REDACTED');
    if (u.searchParams.has('api_key')) u.searchParams.set('api_key', 'REDACTED');
    return u.toString();
  } catch {
    // Fallback simple replace
    return url
      .replace(/(\bkey=)[^&\s]+/gi, '$1REDACTED')
      .replace(/(\bapi_key=)[^&\s]+/gi, '$1REDACTED');
  }
}

