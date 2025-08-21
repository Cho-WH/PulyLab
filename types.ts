
export enum AppState {
  UPLOAD,
  ANALYZING,
  CHATTING,
  ERROR,
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ProblemInput {
  text?: string;
  image?: {
    mimeType: string;
    data: string;
  };
}
