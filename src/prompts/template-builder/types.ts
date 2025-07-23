export interface PromptComponent {
  content: string | ((context: any) => string);
  estimatedTokens?: number | ((context: any) => number);
}

export interface PromptBuildContext {
  // Core context
  codeTrace?: string;
  className?: string;
  methodName?: string;
  
  // Chunking context
  chunkIndex?: number;
  totalChunks?: number;
  previousDocument?: string;
  
  // Two-stage processing context
  chunkAnalyses?: string;
  chunkCount?: number;
  
  // Business context
  businessContext?: string;
  
  // Additional context
  [key: string]: any;
}

export interface PromptTemplate {
  name: string;
  template: string;
  requiredComponents: string[];
}

export interface ComponentRegistry {
  [componentName: string]: PromptComponent;
}