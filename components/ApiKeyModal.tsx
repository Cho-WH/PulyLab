import React, { useState } from 'react';
import { useApiKey } from '../context/ApiKeyContext';
import { isLikelyValidKey } from '../services/apiKeyStore';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const { apiKey, setApiKey, clearApiKey } = useApiKey();
  const [value, setValue] = useState(apiKey || '');
  const [show, setShow] = useState(false);
  const [persist, setPersist] = useState(false);

  if (!isOpen) return null;

  const canSave = isLikelyValidKey(value);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">
        <h2 className="text-xl font-bold text-gray-800">Gemini API 키 설정</h2>
        <p className="text-sm text-gray-600 mt-2">사용자 본인의 API 키를 입력하세요. 키는 서버에 저장되지 않습니다.</p>

        <label className="block mt-4 text-sm font-medium text-gray-700">API 키</label>
        <div className="relative mt-1">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value.trim())}
            className="w-full border border-gray-300 rounded-lg p-2 pr-20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="예: AIza..."
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-blue-600"
          >
            {show ? '숨기기' : '보기'}
          </button>
        </div>

        <label className="inline-flex items-center mt-3 space-x-2 select-none">
          <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} />
          <span className="text-sm text-gray-700">이 브라우저에 저장</span>
        </label>

        <div className="mt-6 flex justify-between">
          <button
            onClick={() => { clearApiKey(); setValue(''); onClose(); }}
            className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
          >
            삭제
          </button>
          <div className="space-x-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50">취소</button>
            <button
              onClick={() => { setApiKey(value, persist); onClose(); }}
              disabled={!canSave}
              className={`px-4 py-2 rounded-lg text-white ${canSave ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'}`}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;

