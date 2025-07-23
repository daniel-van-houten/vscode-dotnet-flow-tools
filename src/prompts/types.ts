import type { PromptComponent } from './template-builder/types';

export interface PromptContext {
  codeTrace: string;
  className: string;
  methodName: string;
}

export interface ComposedPrompt {
  messages: import('vscode').LanguageModelChatMessage[];
  totalTokens: number;
  components: Record<string, PromptComponent>;
}