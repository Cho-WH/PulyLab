import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getMemoryKey, setMemoryKey, loadPersistedKey, persistKey } from '../services/apiKeyStore';
import { validateApiKey } from '../services/geminiService';

export type ApiKeyStatus = 'unset' | 'checking' | 'valid' | 'invalid';

type ApiKeyContextType = {
  apiKey: string | null;
  status: ApiKeyStatus;
  isValid: boolean; // convenience alias of status === 'valid'
  isPersisted: boolean;
  error: string | null;
  setApiKey: (key: string, persist?: boolean) => void;
  validateKey: () => Promise<boolean>;
  clearApiKey: () => void;
};

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [status, setStatus] = useState<ApiKeyStatus>('unset');
  const [error, setError] = useState<string | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean>(false);
  const validatingRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const persisted = loadPersistedKey();
    const initial = getMemoryKey() || persisted;
    if (initial) {
      setApiKeyState(initial);
      setMemoryKey(initial);
      setIsPersisted(!!persisted);
      setStatus('checking');
      // Kick off initial validation
      void runValidation(initial);
    } else {
      setStatus('unset');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runValidation = async (key: string): Promise<boolean> => {
    try {
      setStatus('checking');
      setError(null);
      // Abort previous in-flight validation if any
      if (validatingRef.current) validatingRef.current.abort();
      const ac = new AbortController();
      validatingRef.current = ac;
      const { ok, status } = await validateApiKey(key, { signal: ac.signal });
      if (ok) {
        setStatus('valid');
        setError(null);
        return true;
      }
      // 401/403 treated as invalid; others as temporary failures
      if (status === 401 || status === 403) {
        setStatus('invalid');
        setError('키가 없거나 유효하지 않습니다.');
      } else {
        setStatus('invalid');
        setError('네트워크 또는 서버 문제로 확인에 실패했습니다. 잠시 후 다시 시도하세요.');
      }
      return false;
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return false;
      setStatus('invalid');
      setError('검증 중 오류가 발생했습니다. 인터넷 연결을 확인하세요.');
      return false;
    }
  };

  const setApiKey = (key: string, persist?: boolean) => {
    setApiKeyState(key);
    setMemoryKey(key);
    if (persist) {
      persistKey(key);
      setIsPersisted(true);
    } else {
      persistKey(null);
      setIsPersisted(false);
    }
    void runValidation(key);
  };

  const validateKey = async (): Promise<boolean> => {
    if (!apiKey) return false;
    return runValidation(apiKey);
  };

  const clearApiKey = () => {
    setApiKeyState(null);
    setMemoryKey(null);
    persistKey(null);
    setIsPersisted(false);
    setStatus('unset');
    setError(null);
    if (validatingRef.current) validatingRef.current.abort();
    validatingRef.current = null;
  };

  const value: ApiKeyContextType = useMemo(() => ({
    apiKey,
    status,
    isValid: status === 'valid',
    isPersisted,
    error,
    setApiKey,
    validateKey,
    clearApiKey,
  }), [apiKey, status, isPersisted, error]);

  return <ApiKeyContext.Provider value={value}>{children}</ApiKeyContext.Provider>;
};

export function useApiKey(): ApiKeyContextType {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) throw new Error('useApiKey must be used within ApiKeyProvider');
  return ctx;
}
