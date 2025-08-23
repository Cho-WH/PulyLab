import React from 'react';
import { useApiKey } from '../context/ApiKeyContext';

interface Props {
  children: React.ReactNode;
  onRequireKey?: () => void;
}

const CtaGuard: React.FC<Props> = ({ children, onRequireKey }) => {
  const { status } = useApiKey();
  const blocked = status !== 'valid';

  if (!blocked) return <>{children}</>;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onRequireKey}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRequireKey?.(); }}
      className="opacity-70 cursor-not-allowed"
      title="먼저 API 키를 등록하세요"
      aria-disabled="true"
    >
      {children}
    </div>
  );
};

export default CtaGuard;

