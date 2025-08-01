import * as vscode from 'vscode';
import { ProcessingContext, ProcessingResult, AnalysisResult } from './types';
import { IModelProvider } from '../../providers/IModelProvider';
import { chunkingDecisionEngine } from './ChunkingDecisionEngine';
import { parseTrace, validateTraceStructure as validateTrace } from './parser';
import { chunkTrace } from './chunker';
import { TraceValidationError, TokenLimitExceededError } from './errors';
import { templateProcessor, PromptBuildContext, ProgressiveDocumentationContext, DocumentationSummary } from '../template-builder';

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
    context.progressCallback?.(`Analyzing ${chunks.length} chunks with progressive documentation building`);

    const chunkAnalyses: string[] = [];
    let progressiveContext: ProgressiveDocumentationContext = {
      documentedMethods: new Set(),
      referencedButNotAnalyzed: new Set(),
      identifiedPatterns: [],
      pendingQuestions: [],
      integrationHints: new Map()
    };
    let cumulativeDocumentation = '';

    for (let i = 0; i < chunks.length; i++) {
      if (context.cancellationToken?.isCancellationRequested) {
        throw new vscode.CancellationError();
      }

      const chunkIndex = i + 1;
      const isFirstChunk = chunkIndex === 1;
      const isLastChunk = chunkIndex === chunks.length;
      
      // Determine chunk position for position-aware prompting
      const chunkPosition: 'first' | 'middle' | 'last' = 
        isFirstChunk ? 'first' : isLastChunk ? 'last' : 'middle';

      const promptContext: PromptBuildContext = {
        codeTrace: chunks[i].content,
        className: context.className,
        methodName: context.methodName,
        chunkIndex,
        totalChunks: chunks.length,
        businessContext: context.businessContext,
        chunkPosition,
        progressiveContext,
        previousDocument: cumulativeDocumentation
      };

      const prompt = templateProcessor.buildPrompt('chunk-analysis', promptContext);
      const analysis = await this.invokeProvider(prompt, provider, context.cancellationToken, PROCESSING_CONFIG.CHUNK_ANALYSIS_TEMPERATURE);
      
      // Store the analysis
      chunkAnalyses.push(`## Chunk ${chunkIndex} Analysis\n\n${analysis.trim()}`);
      
      // Update progressive context for next iteration
      progressiveContext = await this.updateProgressiveContext(progressiveContext, analysis, chunks[i], provider);
      
      // Update cumulative documentation
      if (isFirstChunk) {
        cumulativeDocumentation = analysis.trim();
      } else {
        // For middle and last chunks, we maintain a structured summary rather than full text
        // to manage token usage efficiently
        cumulativeDocumentation = await this.buildStructuredSummary(progressiveContext, provider);
      }

      context.progressCallback?.(`Processed chunk ${chunkIndex} of ${chunks.length}`);
    }

    return chunkAnalyses;
  }

  /**
   * Updates progressive context based on the latest chunk analysis
   */
  private async updateProgressiveContext(
    currentContext: ProgressiveDocumentationContext, 
    analysis: string, 
    chunk: any, 
    provider: IModelProvider
  ): Promise<ProgressiveDocumentationContext> {
    // Extract method names from the chunk
    const methodPattern = /(?:class|interface|struct)\s+\w+.*?(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(?:\w+\s+)*(\w+)\s*\(/g;
    const chunkMethods = new Set<string>();
    let match;
    
    while ((match = methodPattern.exec(chunk.content)) !== null) {
      chunkMethods.add(match[1]);
    }

    // Simple pattern detection - look for common business patterns in the analysis
    const newPatterns: string[] = [];
    if (analysis.toLowerCase().includes('validation')) {
      newPatterns.push('Data validation pattern detected');
    }
    if (analysis.toLowerCase().includes('transformation')) {
      newPatterns.push('Data transformation pattern detected');
    }
    if (analysis.toLowerCase().includes('command') || analysis.toLowerCase().includes('handler')) {
      newPatterns.push('Command/Handler pattern detected');
    }

    // Extract business rules from analysis (simple heuristic)
    const businessRules: string[] = [];
    const ruleMatches = analysis.match(/(?:rule|must|should|requirement|constraint):\s*([^.!?]+)/gi);
    if (ruleMatches) {
      businessRules.push(...ruleMatches.map(rule => rule.trim()));
    }

    return {
      ...currentContext,
      documentedMethods: new Set([...currentContext.documentedMethods || [], ...chunkMethods]),
      identifiedPatterns: [...currentContext.identifiedPatterns || [], ...newPatterns],
      documentationSummary: {
        ...currentContext.documentationSummary,
        businessRules: [...currentContext.documentationSummary?.businessRules || [], ...businessRules]
      }
    };
  }

  /**
   * Builds a structured summary for token-efficient context passing
   */
  private async buildStructuredSummary(
    progressiveContext: ProgressiveDocumentationContext, 
    provider: IModelProvider
  ): Promise<string> {
    const summary = progressiveContext.documentationSummary;
    if (!summary) {
      return 'No summary available yet';
    }

    return `
**Main Purpose:** ${summary.mainPurpose || 'To be determined in later chunks'}
**Methods Analyzed:** ${progressiveContext.documentedMethods?.size || 0}
**Business Rules:** ${summary.businessRules?.length || 0} identified
**Patterns Found:** ${progressiveContext.identifiedPatterns?.join(', ') || 'None yet'}
`.trim();
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
