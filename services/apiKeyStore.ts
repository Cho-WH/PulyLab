let memoryKey: string | null = null;

const LS_KEY = 'pulylab_gemini_api_key';

export function loadPersistedKey(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

export function persistKey(key: string | null): void {
  try {
    if (key) localStorage.setItem(LS_KEY, key);
    else localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
}

export function setMemoryKey(key: string | null): void {
  memoryKey = key;
}

export function getMemoryKey(): string | null {
  return memoryKey;
}

export function isLikelyValidKey(key: string): boolean {
  if (!key) return false;
  if (key.length < 8) return false;
  return /^[A-Za-z0-9_\-]+$/.test(key);
}

