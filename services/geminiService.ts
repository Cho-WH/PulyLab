import { GoogleGenAI, Chat, Part } from "@google/genai";
import type { ProblemInput } from '../types';

export function getGenAI(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

// Lightweight key validation against our same-origin proxy.
// Returns only status truthiness to avoid exposing details.
export async function validateApiKey(apiKey: string, opts?: { signal?: AbortSignal }): Promise<{ ok: boolean; status: number }>{
  try {
    const resp = await fetch('/api-proxy/v1beta/models', {
      method: 'GET',
      headers: { 'X-Goog-Api-Key': apiKey },
      signal: opts?.signal,
    });
    return { ok: resp.ok, status: resp.status };
  } catch {
    // Network/abort errors: treat as failure with status 0
    return { ok: false, status: 0 };
  }
}

export async function analyzeProblem(apiKey: string, problem: ProblemInput, isProMode: boolean): Promise<string> {
  const model = isProMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
  
  const promptParts: Part[] = [
    {
      text: `다음 과학 문제를 분석하고, 학생을 가르치는 데 사용할 상세한 단계별 풀이 과정을 작성해주세요. 이 풀이는 학생에게 직접 보여주지 않을 내부 자료입니다. 오직 풀이 과정만 응답으로 생성해주세요.

      문제:
      ${problem.text || ''}`
    },
  ];

  if (problem.image) {
    promptParts.push({
      inlineData: {
        mimeType: problem.image.mimeType,
        data: problem.image.data,
      },
    });
  }

  const ai = getGenAI(apiKey);
  const response = await ai.models.generateContent({
    model,
    contents: { parts: promptParts },
  });

  const solutionText = response.text;
  if (!solutionText) {
      throw new Error("API로부터 풀이를 생성하는 데 실패했습니다.");
  }
  return solutionText;
}

export function createChatSession(apiKey: string, internalSolution: string): Chat {
  const systemInstruction = `
## 지식 (Knowledge Base)
이것은 학생에게 절대 보여주지 말고, 학생을 안내하는 데에만 사용해야 할 문제의 전체 풀이입니다:
---
${internalSolution}
---
`;

  const ai = getGenAI(apiKey);
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemInstruction,
    },
  });
  return chat;
}

export function getApiErrorMessage(error: unknown): string {
  // Prefer common auth errors first
  try {
    const source = (error as any)?.cause || error;
    const numericStatus = (source as any)?.status || (source as any)?.response?.status;
    if (numericStatus === 401 || numericStatus === 403) {
      return '키가 없거나 유효하지 않습니다. 키를 확인해 주세요.';
    }
    const apiErrorDetails = (source as any)?.error;
    if (apiErrorDetails?.code === 401 || apiErrorDetails?.code === 403) {
      return '키가 없거나 유효하지 않습니다. 키를 확인해 주세요.';
    }

    // Quota/limit specific messages
    if (apiErrorDetails?.status === 'RESOURCE_EXHAUSTED' && Array.isArray(apiErrorDetails.details)) {
      const quotaFailure = apiErrorDetails.details.find((d: any) => d['@type']?.includes('QuotaFailure'));
      if (quotaFailure?.violations?.[0]?.quotaLimit) {
        const limitType = String(quotaFailure.violations[0].quotaLimit || '').toLowerCase();
        if (limitType.includes('perminute')) return '요청이 많습니다. 1분 후 다시 시도해 주세요.';
        if (limitType.includes('perday')) return '일일 사용량이 소진되었습니다. 내일 다시 시도해 주세요.';
      }
    }
  } catch {
    // swallow parsing errors
  }
  return '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}
