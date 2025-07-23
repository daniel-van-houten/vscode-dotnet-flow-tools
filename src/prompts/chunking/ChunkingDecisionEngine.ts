import { IModelProvider } from '../../providers/IModelProvider';
import { templateProcessor, PromptBuildContext } from '../template-builder';
import { ParsedTrace } from './types';
import { getComponentContent } from '../template-builder/components';
import { PROCESSING_CONFIG } from './config';

export interface ChunkingAnalysis {
  needsChunking: boolean;
  estimatedChunks: number;
  totalTokens: number;
  availableTokensPerChunk: number;
  approach: 'single-shot' | 'chunked';
  recommendation: string;
}

export interface TokenCalculation {
  promptTokens: number;
  outputTokens: number;
  safetyBuffer: number;
  totalRequired: number;
  maxInputTokens: number;
  exceeds: boolean;
}

/**
 * Centralized chunking decision engine - single source of truth for all chunking logic
 */
export class ChunkingDecisionEngine {
  private readonly safetyBuffer = 500;

  /**
   * Primary method to determine if content needs chunking
   * This is the authoritative decision point used by all components
   */
  async shouldChunk(
    traceContent: string,
    provider: IModelProvider
  ): Promise<boolean> {

    const tokenCalc = await this.calculateTokenRequirements(traceContent, provider);
    
    return tokenCalc.exceeds;
  }

  /**
   * Comprehensive analysis for planning and reporting purposes
   */
  async analyzeChunkingNeeds(
    parsedTrace: ParsedTrace,
    provider: IModelProvider,
    context?: { className: string; methodName: string }
  ): Promise<ChunkingAnalysis> {
    const completeContent = this.buildCompleteTraceContent(parsedTrace);
    const needsChunking = await this.shouldChunk(completeContent, provider);

    if (!needsChunking) {
      const promptContext: PromptBuildContext = {
        codeTrace: completeContent,
        className: context?.className || '',
        methodName: context?.methodName || ''
      };
      const singleShotPrompt = templateProcessor.buildPrompt('single-shot', promptContext);
      const totalTokens = await provider.tokenManager.countTokens(singleShotPrompt, provider.currentModelId);
      
      return {
        needsChunking: false,
        estimatedChunks: 1,
        totalTokens,
        availableTokensPerChunk: totalTokens,
        approach: 'single-shot',
        recommendation: this.buildRecommendation(totalTokens, 1, 'single-shot')
      };
    }

    // Calculate chunking metrics
    const chunkingMetrics = await this.calculateChunkingMetrics(parsedTrace, provider);
    
    return {
      needsChunking: true,
      estimatedChunks: chunkingMetrics.estimatedChunks,
      totalTokens: chunkingMetrics.totalTokens,
      availableTokensPerChunk: chunkingMetrics.availableTokensPerChunk,
      approach: 'chunked',
      recommendation: this.buildRecommendation(chunkingMetrics.totalTokens, chunkingMetrics.estimatedChunks, 'chunked')
    };
  }

  /**
   * Calculate token requirements for a complete prompt
   */
  private async calculateTokenRequirements(
    prompt: string,
    provider: IModelProvider
  ): Promise<TokenCalculation> {
    const promptTokens = await provider.tokenManager.countTokens(prompt, provider.currentModelId);
    const maxInputTokens = provider.tokenManager.getMaxInputTokens(provider.currentModelId);
    const outputTokens = provider.tokenManager.getMaxOutputTokens(provider.currentModelId);
    
    const totalRequired = promptTokens + outputTokens + this.safetyBuffer;
    const exceeds = totalRequired > maxInputTokens;

    return {
      promptTokens,
      outputTokens,
      safetyBuffer: this.safetyBuffer,
      totalRequired,
      maxInputTokens,
      exceeds
    };
  }

  /**
   * Calculate detailed metrics for chunked processing
   */
  private async calculateChunkingMetrics(
    parsedTrace: ParsedTrace,
    provider: IModelProvider
  ): Promise<{
    estimatedChunks: number;
    totalTokens: number;
    availableTokensPerChunk: number;
  }> {
    const maxInputTokens = provider.tokenManager.getMaxInputTokens(provider.currentModelId);
    const maxOutputTokens = provider.tokenManager.getMaxOutputTokens(provider.currentModelId);
    const maxTotalInputAllowed = maxInputTokens - maxOutputTokens - this.safetyBuffer;

    // Calculate fixed components that appear in every chunk
    const callGraphTokens = await provider.tokenManager.countTokens(parsedTrace.callGraph, provider.currentModelId);
    const chunkAnalysisInstructionsContent = getComponentContent('chunkAnalysisInstructions', { 
      chunkIndex: 1, 
      totalChunks: 1 
    } as PromptBuildContext);
    const chunkAnalysisInstructionsTokens = await provider.tokenManager.countTokens(chunkAnalysisInstructionsContent, provider.currentModelId);
    
    const fixedTokensPerChunk = callGraphTokens + chunkAnalysisInstructionsTokens;
    const availableTokensPerChunk = maxTotalInputAllowed - fixedTokensPerChunk;

    // Calculate total tokens for all code sections
    let totalCodeTokens = 0;
    for (const section of parsedTrace.codeSections) {
      totalCodeTokens += await provider.tokenManager.countTokens(section.content, provider.currentModelId);
    }

    const totalTokens = callGraphTokens + chunkAnalysisInstructionsTokens + totalCodeTokens;
    const estimatedChunks = Math.max(1, Math.ceil(totalCodeTokens / Math.max(1, availableTokensPerChunk)));

    return {
      estimatedChunks,
      totalTokens,
      availableTokensPerChunk
    };
  }

  /**
   * Build complete trace content as it would appear in a single-shot prompt
   */
  private buildCompleteTraceContent(parsedTrace: ParsedTrace): string {
    const { callGraph, codeSections } = parsedTrace;
    const codeContent = codeSections.map(s => s.content).join('\n\n');

    return `${callGraph}

<!-- CODE-BEGIN -->
${codeContent}
<!-- CODE-END -->`;
  }

  /**
   * Build recommendation message for users
   */
  private buildRecommendation(totalTokens: number, chunkCount: number, approach: 'single-shot' | 'chunked'): string {
    if (approach === 'single-shot') {
      return `This trace can be processed in a single request (${totalTokens.toLocaleString()} tokens).`;
    }

    const chunkText = chunkCount === 1 ? 'chunk' : 'chunks';
    return `This trace is large (${totalTokens.toLocaleString()} tokens) and will be processed using two-stage chunking: ${chunkCount} ${chunkText} for analysis, then consolidation into final document.`;
  }
}

// Export singleton instance
export const chunkingDecisionEngine = new ChunkingDecisionEngine();
