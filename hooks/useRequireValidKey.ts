import { useCallback } from 'react';
import { useApiKey } from '../context/ApiKeyContext';

// Simple helper to guard actions that require a valid API key.
export function useRequireValidKey(onRequireKey?: () => void) {
  const { status } = useApiKey();
  const isValid = status === 'valid';

  const run = useCallback(<T extends any[]>(fn: (...args: T) => void) => {
    return (...args: T) => {
      if (!isValid) {
        onRequireKey?.();
        return false as unknown as void;
      }
      return fn(...args);
    };
  }, [isValid, onRequireKey]);

  return { isValid, requireValidKey: run };
}

