export interface Conversation {
  id: number;
  title: string;
  system_prompt: string;
  created_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface Provider {
  id: number;
  name: string;
  base_url: string;
  api_key_masked: string;
  model: string;
  is_active: boolean;
  created_at: string;
}

export interface ProviderPreset {
  name: string;
  base_url: string;
  default_model: string;
  key_hint: string;
  doc_url: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
}

export interface StreamError {
  code: string;
  message: string;
  hint: string;
}

export interface TestResult {
  ok: boolean;
  code?: string;
  message?: string;
  hint?: string;
}

export type ChatMode = 'chat' | 'regenerate' | 'continue';
