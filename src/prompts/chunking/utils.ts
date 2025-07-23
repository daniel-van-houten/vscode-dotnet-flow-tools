// Re-export validation functions directly to eliminate redundant wrapper
export { validateTraceStructure as validateTrace } from './parser';
export { TraceValidationError } from './errors';

export function reportProgress(
  callback: ((message: string, increment?: number) => void) | undefined, 
  message: string, 
  increment?: number
): void {
  callback?.(message, increment);
}

export function buildRecommendation(analysis: any, approach: 'single-shot' | 'chunked'): string {
  if (approach === 'single-shot') {
    return `This trace can be processed in a single request (${analysis.totalTokens.toLocaleString()} tokens).`;
  }

  const chunkText = analysis.estimatedChunks === 1 ? 'chunk' : 'chunks';
  return `This trace is large (${analysis.totalTokens.toLocaleString()} tokens) and will be processed using two-stage chunking: ${analysis.estimatedChunks} ${chunkText} for analysis, then consolidation into final document.`;
}
