import * as vscode from 'vscode';
import { ProcessingContext, ProcessingResult, AnalysisResult } from './types';
import { IModelProvider } from '../../providers/IModelProvider';
import { chunkingDecisionEngine } from './ChunkingDecisionEngine';
import { parseTrace } from './parser';
import { chunkTrace } from './chunker';
import { validateTrace, TraceValidationError } from './utils';
import { SingleShotStrategy } from './strategies/SingleShotStrategy';
import { ChunkedStrategy } from './strategies/ChunkedStrategy';

export class DocumentationOrchestrator {
  async processDocumentation(context: ProcessingContext, provider: IModelProvider): Promise<ProcessingResult> {
    // Validate trace structure
    const validation = validateTrace(context.traceContent);
    if (!validation.isValid) {
      throw new TraceValidationError(validation.error || 'Unknown validation error');
    }

    // Use centralized chunking decision engine
    const needsChunking = await chunkingDecisionEngine.shouldChunk(context.traceContent, provider);
    const approach = needsChunking ? 'chunked' : 'single-shot';

    console.log(`Processing with ${approach} approach`);

    // Process using direct conditional logic instead of strategy pattern
    let content: string;
    let chunkCount: number;

    if (approach === 'single-shot') {
      const singleShotStrategy = new SingleShotStrategy();
      content = await singleShotStrategy.process(context, provider);
      chunkCount = 1;
    } else {
      const chunkedStrategy = new ChunkedStrategy();
      content = await chunkedStrategy.process(context, provider);
      // Calculate actual chunk count
      const parsedTrace = parseTrace(context.traceContent);
      const chunks = await chunkTrace(parsedTrace, provider);
      chunkCount = chunks.length;
    }

    return {
      content,
      approach,
      chunkCount
    };
  }
}

// Public API
const orchestrator = new DocumentationOrchestrator();

/**
 * Unified processing function that handles both single-shot and chunked approaches
 */
export async function processDocumentation(
  traceContent: string,
  provider: IModelProvider,
  context: { className: string; methodName: string },
  businessContext?: string,
  cancellationToken?: vscode.CancellationToken,
  progressCallback?: (message: string, increment?: number) => void
): Promise<ProcessingResult> {
  const processingContext: ProcessingContext = {
    traceContent,
    className: context.className,
    methodName: context.methodName,
    businessContext,
    cancellationToken,
    progressCallback
  };

  return orchestrator.processDocumentation(processingContext, provider);
}

/**
 * Analyzes a trace and provides processing recommendations
 */
export async function analyzeProcessingApproach(
  traceContent: string,
  provider: IModelProvider
): Promise<AnalysisResult> {
  // Validate trace structure
  const validation = validateTrace(traceContent);
  if (!validation.isValid) {
    throw new TraceValidationError(validation.error || 'Unknown validation error');
  }

  const maxTokens = provider.tokenManager.getMaxInputTokens();
  const parsedTrace = parseTrace(traceContent);
  const analysis = await chunkingDecisionEngine.analyzeChunkingNeeds(parsedTrace, provider);

  return {
    approach: analysis.approach,
    estimatedTokens: analysis.totalTokens,
    maxTokens,
    chunkCount: analysis.estimatedChunks,
    recommendation: analysis.recommendation
  };
}

// Re-export types for convenience
export type { ProcessingContext, ProcessingResult, AnalysisResult } from './types';
