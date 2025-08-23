import React from 'react';
import { useApiKey } from '../context/ApiKeyContext';

interface Props {
  onManage?: () => void;
}

const statusMap: Record<string, { label: string; className: string }> = {
  unset: { label: '키 미설정', className: 'bg-gray-200 text-gray-800' },
  checking: { label: '검증 중', className: 'bg-amber-100 text-amber-800' },
  valid: { label: '키 준비됨', className: 'bg-green-100 text-green-800' },
  invalid: { label: '키 오류', className: 'bg-red-100 text-red-800' },
};

const ApiKeyStatusBadge: React.FC<Props> = ({ onManage }) => {
  const { status } = useApiKey();
  const cfg = statusMap[status] || statusMap.unset;

  return (
    <button
      type="button"
      onClick={onManage}
      className={`fixed top-4 right-4 text-sm font-medium px-3 py-1 rounded-full shadow ${cfg.className} hover:opacity-90`}
      aria-label="API 키 상태 및 관리"
    >
      {cfg.label}
    </button>
  );
};

export default ApiKeyStatusBadge;

