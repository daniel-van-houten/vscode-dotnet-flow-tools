/**
 * Simplified prompt component interface (replaces IStaticComponent, IDynamicComponent, IConditionalComponent)
 */
export interface PromptComponent {
  content: string | ((context: PromptBuildContext) => string);
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
  
  // Progressive documentation context
  progressiveContext?: ProgressiveDocumentationContext;
  chunkPosition?: 'first' | 'middle' | 'last';
  
  // Two-stage processing context
  chunkAnalyses?: string;
  chunkCount?: number;
  
  // Business context
  businessContext?: string;
  
  // Additional context
  [key: string]: any;
}

/**
 * Progressive documentation context for maintaining state across chunks
 */
export interface ProgressiveDocumentationContext {
  // Structured summary of documentation built so far
  documentationSummary?: DocumentationSummary;
  
  // Cross-references and state tracking
  documentedMethods?: Set<string>;
  referencedButNotAnalyzed?: Set<string>;
  
  // Business logic patterns identified
  identifiedPatterns?: string[];
  
  // Open questions needing resolution
  pendingQuestions?: string[];
  
  // Integration hints for continuity
  integrationHints?: Map<string, string>;
}

/**
 * Structured summary of documentation for token-efficient context passing
 */
export interface DocumentationSummary {
  mainPurpose?: string;
  keySteps?: Array<{
    step: string;
    businessLogic: string;
    technical: string;
  }>;
  businessRules?: string[];
  dataTransformations?: string[];
  assumptions?: string[];
}

export interface PromptTemplate {
  name: string;
  template: string;
  requiredComponents: string[];
}

export interface ComponentRegistry {
  [componentName: string]: PromptComponent;
}