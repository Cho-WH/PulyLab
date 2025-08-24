import { GoogleGenAI, Chat, Part } from "@google/genai";
import type { ProblemInput } from '../types';

export function getGenAI(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

// --- Models
export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';
export const FLASH_MODEL: GeminiModel = 'gemini-2.5-flash';
export const PRO_MODEL: GeminiModel = 'gemini-2.5-pro';

// validateApiKey moved to services/apiKeyValidation.ts

export async function analyzeProblem(apiKey: string, problem: ProblemInput, isProMode: boolean): Promise<string>;
export async function analyzeProblem(apiKey: string, problem: ProblemInput, model: GeminiModel): Promise<string>;
export async function analyzeProblem(apiKey: string, problem: ProblemInput, third: boolean | GeminiModel): Promise<string> {
  const model: GeminiModel = (typeof third === 'boolean')
    ? (third ? PRO_MODEL : FLASH_MODEL)
    : third;
  
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
  // Ensure request shape matches API spec: contents must be an array with role
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: promptParts,
      },
    ],
  });

  const solutionText = response.text;
  if (!solutionText) {
      throw new Error("API로부터 풀이를 생성하는 데 실패했습니다.");
  }
  return solutionText;
}

export function createChatSession(apiKey: string, internalSolution: string, opts?: { model?: GeminiModel }): Chat {
  const systemInstruction = `
## 지식 (Knowledge Base)
이것은 학생에게 절대 보여주지 말고, 학생을 안내하는 데에만 사용해야 할 문제의 전체 풀이입니다:
---
${internalSolution}
---
`;

  const ai = getGenAI(apiKey);
  const chat = ai.chats.create({
    model: opts?.model || FLASH_MODEL,
    config: {
      systemInstruction: systemInstruction,
    },
  });
  return chat;
}
