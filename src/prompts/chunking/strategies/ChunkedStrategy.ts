import * as vscode from 'vscode';
import { IProcessingStrategy } from './IProcessingStrategy';
import { ProcessingContext } from '../types';
import { IModelProvider } from '../../../providers/IModelProvider';
import { parseTrace } from '../parser';
import { chunkTrace } from '../chunker';
import { templateProcessor, PromptBuildContext } from '../../template-builder';
import { PROCESSING_CONFIG } from '../config';
import { TokenLimitExceededError } from '../errors';
import { reportProgress } from '../utils';

export class ChunkedStrategy implements IProcessingStrategy {
  async canHandle(tokenCount: number, maxTokens: number): Promise<boolean> {
    return tokenCount > maxTokens * PROCESSING_CONFIG.SAFETY_MARGIN;
  }

  async process(context: ProcessingContext, provider: IModelProvider): Promise<string> {
    const parsedTrace = parseTrace(context.traceContent);
    const chunks = await chunkTrace(parsedTrace, provider);

    if (chunks.length === 0) {
      throw new Error('No chunks generated from trace');
    }

    // Stage 1: Analyze chunks
    const chunkAnalyses = await this.processChunks(chunks, context, provider);

    // Stage 2: Consolidate analyses
    const finalContent = await this.consolidateAnalyses(chunkAnalyses, chunks.length, context, provider);

    reportProgress(context.progressCallback, 'Documentation generation complete');
    return finalContent;
  }

  getApproachName(): 'chunked' {
    return 'chunked';
  }

  private async processChunks(
    chunks: any[],
    context: ProcessingContext,
    provider: IModelProvider
  ): Promise<string[]> {
    reportProgress(context.progressCallback, `Analyzing ${chunks.length} chunks for information extraction`);

    const chunkAnalyses: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      if (context.cancellationToken?.isCancellationRequested) {
        throw new vscode.CancellationError();
      }

      const chunkIndex = i + 1;
      const analysis = await this.processChunk(chunks[i], chunkIndex, chunks.length, context, provider);
      chunkAnalyses.push(`## Chunk ${chunkIndex} Analysis\n\n${analysis.trim()}`);

      reportProgress(context.progressCallback, `Processing chunk ${chunkIndex} of ${chunks.length}`);
    }

    return chunkAnalyses;
  }

  private async processChunk(
    chunk: any,
    chunkIndex: number,
    totalChunks: number,
    context: ProcessingContext,
    provider: IModelProvider
  ): Promise<string> {
    const promptContext: PromptBuildContext = {
      codeTrace: chunk.content,
      className: context.className,
      methodName: context.methodName,
      chunkIndex,
      totalChunks,
      businessContext: context.businessContext
    };

    const prompt = templateProcessor.buildPrompt('chunk-analysis', promptContext);
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];

    const maxTokens = provider.tokenManager.getMaxOutputTokens(provider.currentModelId);
    const response = await provider.invoke(
      messages,
      { 
        maxTokens,
        modelOptions: { temperature: PROCESSING_CONFIG.CHUNK_ANALYSIS_TEMPERATURE } 
      },
      context.cancellationToken
    );

    let responseText = '';
    for await (const fragment of response.text) {
      responseText += fragment;
    }

    return responseText;
  }

  private async consolidateAnalyses(
    chunkAnalyses: string[],
    chunkCount: number,
    context: ProcessingContext,
    provider: IModelProvider
  ): Promise<string> {
    if (context.cancellationToken?.isCancellationRequested) {
      throw new vscode.CancellationError();
    }

    reportProgress(context.progressCallback, `Consolidating ${chunkAnalyses.length} analyses into final document`);

    const consolidationContext: PromptBuildContext = {
      chunkAnalyses: chunkAnalyses.join('\n\n---\n\n'),
      chunkCount,
      className: context.className,
      methodName: context.methodName,
      businessContext: context.businessContext
    };

    await this.validateConsolidationTokens(consolidationContext, provider);

    const consolidationPrompt = templateProcessor.buildPrompt('consolidation', consolidationContext);
    const consolidationMessages = [vscode.LanguageModelChatMessage.User(consolidationPrompt)];

    const maxTokens = provider.tokenManager.getMaxOutputTokens(provider.currentModelId);
    const finalResponse = await provider.invoke(
      consolidationMessages,
      { 
        maxTokens,
        temperature: PROCESSING_CONFIG.CONSOLIDATION_TEMPERATURE 
      },
      context.cancellationToken
    );

    let finalContent = '';
    for await (const fragment of finalResponse.text) {
      finalContent += fragment;
    }

    return finalContent.trim();
  }

  private async validateConsolidationTokens(
    consolidationContext: PromptBuildContext,
    provider: IModelProvider
  ): Promise<void> {
    const consolidationPromptPreview = templateProcessor.buildPrompt('consolidation', consolidationContext);
    const consolidationTokens = await provider.tokenManager.countTokens(consolidationPromptPreview);
    const maxTokens = provider.tokenManager.getMaxInputTokens();

    if (consolidationTokens > maxTokens * PROCESSING_CONFIG.SAFETY_MARGIN) {
      throw new TokenLimitExceededError(consolidationTokens, maxTokens);
    }
  }
}