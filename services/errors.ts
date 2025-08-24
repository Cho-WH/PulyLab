export function getApiErrorMessage(error: unknown): string {
  try {
    const src: any = (error as any)?.cause || error;

    // Prefer explicit numeric status where available
    const status = toStatusCode([
      src?.status,
      src?.response?.status,
      src?.error?.code,
      src?.error?.status,
    ]);

    if (status === 401 || status === 403) {
      return '키가 없거나 유효하지 않습니다. 키를 확인해 주세요.';
    }
    if (status === 404) {
      return '요청 경로 또는 모델이 올바른지 확인하세요.';
    }
    if (status === 408) {
      return '요청 시간이 초과되었습니다. 네트워크 상태를 확인해 주세요.';
    }
    if (status === 429) {
      return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
    }
    if (status && status >= 500 && status < 600) {
      return '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }

    // Quota details from Google-style error payloads
    const apiError = src?.error;
    if (apiError?.status === 'RESOURCE_EXHAUSTED' && Array.isArray(apiError.details)) {
      const quotaFailure = apiError.details.find((d: any) => String(d['@type'] || '').includes('QuotaFailure'));
      if (quotaFailure?.violations?.[0]?.quotaLimit) {
        const limitType = String(quotaFailure.violations[0].quotaLimit || '').toLowerCase();
        if (limitType.includes('perminute')) return '요청이 많습니다. 1분 후 다시 시도해 주세요.';
        if (limitType.includes('perday')) return '일일 사용량이 소진되었습니다. 내일 다시 시도해 주세요.';
      }
      return '사용량 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.';
    }

    // Proxy JSON format: { status, message, details }
    if (typeof src?.message === 'string' && toStatusCode([src?.status])) {
      const s = toStatusCode([src?.status]);
      if (s === 401 || s === 403) return '키가 없거나 유효하지 않습니다. 키를 확인해 주세요.';
      if (s === 404) return '요청 경로 또는 모델이 올바른지 확인하세요.';
      if (s === 429) return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
      if (s && s >= 500) return '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
      // Fallback to message if present
      if (src.message) return String(src.message);
    }

    // Network/offline hints
    if (typeof navigator !== 'undefined' && navigator && 'onLine' in navigator && (navigator as any).onLine === false) {
      return '오프라인 상태입니다. 연결 후 다시 시도해 주세요.';
    }
    const msg = String((src && (src.message || src.toString?.())) || '');
    if (/Failed to fetch|NetworkError|TypeError: fetch/i.test(msg)) {
      return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }
  } catch {
    // ignore mapping errors
  }
  return '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

function toStatusCode(values: any[]): number | null {
  for (const v of values) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10);
  }
  return null;
}

