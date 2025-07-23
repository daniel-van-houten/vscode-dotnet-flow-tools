// Main public API exports
export { processDocumentation, analyzeProcessingApproach } from './DocumentationOrchestrator';

// Type exports
export type { ProcessingContext, ProcessingResult, AnalysisResult } from './types';

// Error exports for consumers who need to handle specific errors
export { TraceValidationError, TokenLimitExceededError } from './errors';

// Strategy exports for advanced users who might want to extend
export type { IProcessingStrategy } from './strategies';
export { SingleShotStrategy, ChunkedStrategy } from './strategies';