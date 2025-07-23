import * as vscode from 'vscode';
import { IModelProvider, ModelInfo, ModelInvokeParams, ModelResponse } from './IModelProvider';
import { BuiltInTokenManager } from './BuiltInTokenManager';

export class BuiltInProvider implements IModelProvider {
  readonly id = 'built-in';
  private model: vscode.LanguageModelChat | null = null;
  private initialized = false;
  readonly tokenManager = new BuiltInTokenManager();

  get currentModelId(): string {
    return this.model?.id || '';
  }

  async initialize(
    config: vscode.WorkspaceConfiguration, 
    modelId: string,
    context: vscode.ExtensionContext
  ): Promise<void> {
    // If no specific model ID provided, fall back to any available Copilot model
    if (!modelId) {
      const [fallback] = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      if (!fallback) {
        throw new Error('No Copilot models available. Please ensure GitHub Copilot is installed and you have given consent to use AI features.');
      }
      this.model = fallback;
    } else {
      // Try to get the specific model
      const [exact] = await vscode.lm.selectChatModels({ id: modelId });
      if (exact) {
        this.model = exact;
      } else {
        // Fall back to any Copilot model if specific model not found
        const [fallback] = await vscode.lm.selectChatModels({ vendor: 'copilot' });
        if (!fallback) {
          throw new Error(`Model '${modelId}' not found and no fallback Copilot models available.`);
        }
        this.model = fallback;
        console.warn(`Model '${modelId}' not found, falling back to ${fallback.name || fallback.id}`);
      }
    }

    this.initialized = true;
    
    // Update token manager with current model
    this.tokenManager.setCurrentModel(this.model);
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const models = await vscode.lm.selectChatModels();
      return models.map(model => ({
        id: model.id,
        name: model.name || model.family || model.id,
        description: `${model.vendor || 'Unknown'} - ${model.family || 'Language Model'} • ${model.maxInputTokens?.toLocaleString() || 'Unknown'} tokens`,
        vendor: model.vendor,
        version: model.version
      }));
    } catch (error) {
      console.error('Failed to list built-in models:', error);
      return [];
    }
  }

  async invoke(
    messages: vscode.LanguageModelChatMessage[],
    params?: ModelInvokeParams,
    cancellationToken?: vscode.CancellationToken
  ): Promise<ModelResponse> {
    if (!this.model || !this.initialized) {
      throw new Error('Provider not initialized. Call initialize() first.');
    }

    // Convert our generic params to VS Code specific options
    const options: vscode.LanguageModelChatRequestOptions = {};
    
    if (params?.modelOptions) {
      options.modelOptions = params.modelOptions;
    } else if (params?.temperature !== undefined) {
      options.modelOptions = {
        temperature: params.temperature
      };
    }

    try {
      const response = await this.model.sendRequest(messages, options, cancellationToken);
      
      return {
        text: response.text,
        // VS Code doesn't provide token count in response
        totalTokens: undefined
      };
    } catch (error) {
      if (error instanceof vscode.LanguageModelError) {
        // Re-throw with more context
        let errorMessage = `Built-in provider failed: ${error.message}`;
        
        if (error.message.includes('consent') || error.message.includes('permission')) {
          errorMessage = 'Please give consent to use AI features in VS Code.';
        } else if (error.message.includes('blocked') || error.message.includes('content policy')) {
          errorMessage = 'Request was blocked by content policy. Please try with different content.';
        } else if (error.message.includes('throttled') || error.message.includes('rate limit')) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        }
        
        throw new Error(errorMessage);
      }
      
      throw error;
    }
  }

  dispose(): void {
    this.model = null;
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized && this.model !== null;
  }
}