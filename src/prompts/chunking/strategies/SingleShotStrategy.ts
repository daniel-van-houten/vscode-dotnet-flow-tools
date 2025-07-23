import * as vscode from 'vscode';
import { IProcessingStrategy } from './IProcessingStrategy';
import { ProcessingContext } from '../types';
import { IModelProvider } from '../../../providers/IModelProvider';
import { templateProcessor, PromptBuildContext } from '../../template-builder';
import { PROCESSING_CONFIG } from '../config';
import { reportProgress } from '../utils';

export class SingleShotStrategy implements IProcessingStrategy {
  async canHandle(tokenCount: number, maxTokens: number): Promise<boolean> {
    return tokenCount <= maxTokens * PROCESSING_CONFIG.SAFETY_MARGIN;
  }

  async process(context: ProcessingContext, provider: IModelProvider): Promise<string> {
    const promptContext = this.buildPromptContext(context);
    const prompt = templateProcessor.buildPrompt('single-shot', promptContext);

    reportProgress(context.progressCallback, 'Generating documentation...');

    const content = await this.invokeProvider(prompt, provider, context.cancellationToken);

    reportProgress(context.progressCallback, 'Documentation generation complete');
    return content;
  }

  getApproachName(): 'single-shot' {
    return 'single-shot';
  }

  private buildPromptContext(context: ProcessingContext): PromptBuildContext {
    return {
      codeTrace: context.traceContent,
      className: context.className,
      methodName: context.methodName,
      businessContext: context.businessContext
    };
  }

  private async invokeProvider(
    prompt: string,
    provider: IModelProvider,
    cancellationToken?: vscode.CancellationToken
  ): Promise<string> {
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    const maxTokens = provider.tokenManager.getMaxOutputTokens(provider.currentModelId);
    const response = await provider.invoke(
      messages,
      { 
        maxTokens,
        modelOptions: { temperature: PROCESSING_CONFIG.SINGLE_SHOT_TEMPERATURE } 
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