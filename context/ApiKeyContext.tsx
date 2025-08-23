import React, { createContext, useContext, useEffect, useState } from 'react';
import { getMemoryKey, setMemoryKey, loadPersistedKey, persistKey, isLikelyValidKey } from '../services/apiKeyStore';

type ApiKeyContextType = {
  apiKey: string | null;
  setApiKey: (key: string, persist?: boolean) => void;
  clearApiKey: () => void;
  isValid: boolean;
};

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  useEffect(() => {
    const persisted = loadPersistedKey();
    const initial = getMemoryKey() || persisted;
    if (initial) {
      setApiKeyState(initial);
      setMemoryKey(initial);
    }
  }, []);

  const setApiKey = (key: string, persist?: boolean) => {
    setApiKeyState(key);
    setMemoryKey(key);
    if (persist) persistKey(key);
  };

  const clearApiKey = () => {
    setApiKeyState(null);
    setMemoryKey(null);
    persistKey(null);
  };

  const value: ApiKeyContextType = {
    apiKey,
    setApiKey,
    clearApiKey,
    isValid: apiKey ? isLikelyValidKey(apiKey) : false,
  };

  return <ApiKeyContext.Provider value={value}>{children}</ApiKeyContext.Provider>;
};

export function useApiKey(): ApiKeyContextType {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) throw new Error('useApiKey must be used within ApiKeyProvider');
  return ctx;
}

