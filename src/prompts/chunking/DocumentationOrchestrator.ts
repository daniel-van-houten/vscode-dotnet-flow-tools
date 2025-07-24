import * as vscode from 'vscode';
import { ProcessingContext, ProcessingResult, AnalysisResult } from './types';
import { IModelProvider } from '../../providers/IModelProvider';
import { chunkingDecisionEngine } from './ChunkingDecisionEngine';
import { parseTrace, validateTraceStructure as validateTrace } from './parser';
import { chunkTrace } from './chunker';
import { TraceValidationError, TokenLimitExceededError } from './errors';
import { templateProcessor, PromptBuildContext } from '../template-builder';

// Processing configuration constants
const PROCESSING_CONFIG = {
  SINGLE_SHOT_TEMPERATURE: 0.00,
  CHUNK_ANALYSIS_TEMPERATURE: 0.00,
  CONSOLIDATION_TEMPERATURE: 0.00
} as const;

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

    // Process using direct conditional logic - no strategy pattern needed
    let content: string;
    let chunkCount: number;

    if (approach === 'single-shot') {
      content = await this.processSingleShot(context, provider);
      chunkCount = 1;
    } else {
      const result = await this.processChunked(context, provider);
      content = result.content;
      chunkCount = result.chunkCount;
    }

    return {
      content,
      approach,
      chunkCount
    };
  }

  private async processSingleShot(context: ProcessingContext, provider: IModelProvider): Promise<string> {
    const promptContext: PromptBuildContext = {
      codeTrace: context.traceContent,
      className: context.className,
      methodName: context.methodName,
      businessContext: context.businessContext
    };

    const prompt = templateProcessor.buildPrompt('single-shot', promptContext);
    context.progressCallback?.('Generating documentation...');

    const content = await this.invokeProvider(prompt, provider, context.cancellationToken, PROCESSING_CONFIG.SINGLE_SHOT_TEMPERATURE);
    context.progressCallback?.('Documentation generation complete');
    
    return content;
  }

  private async processChunked(context: ProcessingContext, provider: IModelProvider): Promise<{ content: string; chunkCount: number }> {
    const parsedTrace = parseTrace(context.traceContent);
    const chunks = await chunkTrace(parsedTrace, provider);

    if (chunks.length === 0) {
      throw new Error('No chunks generated from trace');
    }

    // Stage 1: Analyze chunks
    const chunkAnalyses = await this.processChunks(chunks, context, provider);

    // Stage 2: Consolidate analyses
    const finalContent = await this.consolidateAnalyses(chunkAnalyses, chunks.length, context, provider);

    context.progressCallback?.('Documentation generation complete');
    return { content: finalContent, chunkCount: chunks.length };
  }

  private async processChunks(chunks: any[], context: ProcessingContext, provider: IModelProvider): Promise<string[]> {
    context.progressCallback?.(`Analyzing ${chunks.length} chunks for information extraction`);

    const chunkAnalyses: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      if (context.cancellationToken?.isCancellationRequested) {
        throw new vscode.CancellationError();
      }

      const chunkIndex = i + 1;
      const promptContext: PromptBuildContext = {
        codeTrace: chunks[i].content,
        className: context.className,
        methodName: context.methodName,
        chunkIndex,
        totalChunks: chunks.length,
        businessContext: context.businessContext
      };

      const prompt = templateProcessor.buildPrompt('chunk-analysis', promptContext);
      const analysis = await this.invokeProvider(prompt, provider, context.cancellationToken, PROCESSING_CONFIG.CHUNK_ANALYSIS_TEMPERATURE);
      chunkAnalyses.push(`## Chunk ${chunkIndex} Analysis\n\n${analysis.trim()}`);

      context.progressCallback?.(`Processing chunk ${chunkIndex} of ${chunks.length}`);
    }

    return chunkAnalyses;
  }

  private async consolidateAnalyses(chunkAnalyses: string[], chunkCount: number, context: ProcessingContext, provider: IModelProvider): Promise<string> {
    if (context.cancellationToken?.isCancellationRequested) {
      throw new vscode.CancellationError();
    }

    context.progressCallback?.(`Consolidating ${chunkAnalyses.length} analyses into final document`);

    const consolidationContext: PromptBuildContext = {
      chunkAnalyses: chunkAnalyses.join('\n\n---\n\n'),
      chunkCount,
      className: context.className,
      methodName: context.methodName,
      businessContext: context.businessContext
    };

    const consolidationPrompt = templateProcessor.buildPrompt('consolidation', consolidationContext);
    
    // Validate consolidation won't exceed tokens
    const consolidationTokens = await provider.tokenManager.countTokens(consolidationPrompt);
    const maxTokens = provider.tokenManager.getMaxInputTokens();
    if (consolidationTokens > maxTokens * 0.9) { // 90% safety margin
      throw new TokenLimitExceededError(consolidationTokens, maxTokens);
    }

    const finalContent = await this.invokeProvider(consolidationPrompt, provider, context.cancellationToken, PROCESSING_CONFIG.CONSOLIDATION_TEMPERATURE);

    return finalContent.trim();
  }

  private async invokeProvider(prompt: string, provider: IModelProvider, cancellationToken?: vscode.CancellationToken, temperature: number = 0.0): Promise<string> {
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    const maxTokens = provider.tokenManager.getMaxOutputTokens(provider.currentModelId);
    const response = await provider.invoke(
      messages,
      { 
        maxTokens,
        modelOptions: { temperature } 
      },
      cancellationToken
    );

    let content = '';
    for await (const fragment of response.text) {
      content += fragment;
    }

    return content;
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
