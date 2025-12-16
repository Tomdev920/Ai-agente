
import { Attachment } from './App';

export const Role = {
  USER: 'user',
  MODEL: 'model'
} as const;

export type Role = typeof Role[keyof typeof Role];

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isError?: boolean;
  attachments?: Attachment[]; // New field for UI display
}

export const ModelType = {
  FLASH: 'gemini-2.5-flash',
  PRO: 'gemini-3-pro-preview',
  FLASH_LITE: 'gemini-flash-lite-latest',
  VEO: 'veo-3.1-fast-generate-preview'
} as const;

export type ModelType = typeof ModelType[keyof typeof ModelType];

export interface ModelConfig {
  id: ModelType;
  name: string;
  description: string;
}

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: ModelType.FLASH,
    name: 'Gemini 2.5 Flash',
    description: 'سريع | بحث Google & Maps | مهام يومية'
  },
  {
    id: ModelType.PRO,
    name: 'Gemini 3.0 Pro (Thinking)',
    description: 'تفكير عميق (32k Token) | تحليل ومنطق معقد'
  },
  {
    id: ModelType.FLASH_LITE,
    name: 'Gemini Flash Lite',
    description: 'خفيف وسريع جداً'
  }
];