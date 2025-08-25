import React, { useState, useEffect } from 'react';
import { useApiKey } from '../context/ApiKeyContext';

const OnboardingKeyPanel: React.FC = () => {
  const { status, error, setApiKey, validateKey } = useApiKey();
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [persist, setPersist] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'checking') setSubmitting(true);
    else setSubmitting(false);
  }, [status]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setApiKey(value.trim(), persist);
    setSubmitting(true);
    await validateKey();
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Gemini API 키 등록</h1>
        <p className="mt-2 text-sm text-gray-600">
          키는 절대 서버에 저장되지 않지만, 무료 api 키만 등록하는 것을 권장합니다.
          <br />
          아직 키가 없다면
          {' '}<a href="https://www.youtube.com/watch?v=RVGbLSVFtIk" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">무료 API 발급 가이드</a>
          {' '}를 참고하세요.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">API 키</label>
            <div className="relative mt-1">
              <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 pr-20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="예: AIza..."
                autoFocus
                aria-invalid={status === 'invalid'}
                aria-describedby="api-key-help api-key-error"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-blue-600"
              >
                {show ? '숨기기' : '보기'}
              </button>
            </div>
            <p id="api-key-help" className="mt-1 text-xs text-gray-500">공용 PC에서는 저장 옵션을 사용하지 마세요.</p>
            {status === 'invalid' && error && (
              <p id="api-key-error" className="mt-2 text-sm text-red-600" aria-live="polite">{error}</p>
            )}
          </div>

          <label className="inline-flex items-center space-x-2 select-none">
            <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} />
            <span className="text-sm text-gray-700">이 브라우저에 저장(선택)</span>
          </label>

          <button
            type="submit"
            disabled={submitting || !value}
            className={`w-full py-2 rounded-lg text-white font-semibold transition-colors ${submitting || !value ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            aria-busy={submitting}
          >
            {submitting ? '검증 중...' : '키 등록하고 시작하기'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingKeyPanel;

