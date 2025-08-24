import React from 'react';
import { useApiKey } from '../context/ApiKeyContext';

interface Props {
  onOpen?: () => void;
}

const ApiKeyBanner: React.FC<Props> = ({ onOpen }) => {
  const { status } = useApiKey();
  if (!(status === 'unset' || status === 'invalid')) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-red-50 border-b border-red-200 text-red-800">
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
        <p className="text-sm font-medium">API 키가 없거나 유효하지 않습니다. 먼저 키를 등록하세요.</p>
        <button onClick={onOpen} className="text-sm font-semibold text-red-800 underline">키 등록/관리</button>
      </div>
    </div>
  );
};

export default ApiKeyBanner;
