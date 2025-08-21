import { GoogleGenAI, Chat, Part } from "@google/genai";
import type { ProblemInput } from '../types';

export function getGenAI(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
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
  // The toLowerCase() check handles case-insensitivity for 'perminute' and 'perday'.
  try {
    // The actual API error from the fetch call is often nested inside the SDK's error object.
    // We look for it in `error.cause` which is a common pattern for wrapped errors.
    const errorSource = (error as any).cause || error;
    const apiErrorDetails = (errorSource as any).error;

    if (apiErrorDetails?.status === 'RESOURCE_EXHAUSTED' && Array.isArray(apiErrorDetails.details)) {
      const quotaFailure = apiErrorDetails.details.find((d: any) => d['@type']?.includes('QuotaFailure'));
      
      if (quotaFailure?.violations?.[0]?.quotaLimit) {
        const limitType = quotaFailure.violations[0].quotaLimit.toLowerCase();
        
        if (limitType.includes('perminute')) {
          return '죄송합니다. 요청이 몰리고 있습니다. 1분 후에 다시 시도해주세요.';
        }
        
        if (limitType.includes('perday')) {
          return '죄송합니다. 사이트의 일일 사용량이 모두 소진되었습니다. 내일 다시 시도해주세요.';
        }
      }
    }
  } catch (parseError) {
    // If parsing the detailed error fails, we fall through to the generic message.
    console.error("Could not parse detailed API error:", parseError);
  }

  // For all other errors that are not specific quota limits,
  // or if parsing fails, we provide a generic fallback message as requested.
  return '알 수 없는 API 관련 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 지속된다면, 내일 다시 시도해주세요.';
}
