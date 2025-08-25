import { GoogleGenAI, Chat, Part } from "@google/genai";
import type { ProblemInput } from '../types';
import { getMemoryKey } from './apiKeyStore';

// --- Models
export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';
export const FLASH_MODEL: GeminiModel = 'gemini-2.5-flash';
export const PRO_MODEL: GeminiModel = 'gemini-2.5-pro';

function requireAI(): GoogleGenAI {
  const key = getMemoryKey();
  if (!key) {
    // Surface a 401-like error so the UI error mapper can produce a friendly message
    const err: any = new Error('API key is missing');
    err.status = 401;
    throw err;
  }
  return new GoogleGenAI({ apiKey: key });
}

// Signature aligned with `main`: only (problem, isProMode)
export async function analyzeProblem(problem: ProblemInput, isProMode: boolean): Promise<string> {
  const model: GeminiModel = isProMode ? PRO_MODEL : FLASH_MODEL;

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

  const ai = requireAI();
  // Align request shape with `main`: contents as a single object with parts
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

// Signature aligned with `main`: only (internalSolution)
export function createChatSession(internalSolution: string): Chat {
  const systemInstruction = `
## 지식 (Knowledge Base)
이것은 학생에게 절대 보여주지 말고, 학생을 안내하는 데에만 사용해야 할 문제의 전체 풀이입니다:
---
${internalSolution}
---
`;

  const ai = requireAI();
  const chat = ai.chats.create({
    model: FLASH_MODEL,
    config: {
      systemInstruction: systemInstruction,
    },
  });
  return chat;
}
