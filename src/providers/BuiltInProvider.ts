import * as vscode from 'vscode';
import { IModelProvider, ModelInfo, ModelInvokeParams, ModelResponse } from './IModelProvider';
import { BuiltInTokenManager } from './BuiltInTokenManager';
import { BuiltInProviderError } from '../core/ErrorTypes';
import { savePromptDebug } from '../core/DebugLogger';

export class BuiltInProvider implements IModelProvider {
  readonly id = 'built-in';
  private model: vscode.LanguageModelChat | null = null;
  private initialized = false;
  readonly tokenManager = new BuiltInTokenManager();

  // Static list of commonly available VS Code language models
  private static readonly MODELS: ModelInfo[] = [
    { id: 'gpt-5', name: 'GPT-5 (Preview)', description: 'OpenAI - GPT-5' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI - GPT-4o' },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'OpenAI - GPT-4.1' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic - Claude 3.5 Sonnet' },
  ];

  get currentModelId(): string {
    return this.model?.id || '';
  }

  async initialize(
    _config: vscode.WorkspaceConfiguration, 
    modelId: string,
    _context: vscode.ExtensionContext
  ): Promise<void> {
    // Validate model ID against static list if provided
    if (modelId && !BuiltInProvider.MODELS.some(m => m.id === modelId)) {
      console.warn(`Model '${modelId}' not in supported list, will attempt fallback`);
    }

    // If no specific model ID provided, fall back to any available Copilot model
    if (!modelId) {
      const [fallback] = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      if (!fallback) {
        throw BuiltInProviderError.modelUnavailable();
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
          throw BuiltInProviderError.modelUnavailable(modelId);
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
    // Return the static list of models
    return BuiltInProvider.MODELS;
  }

  async invoke(
    messages: vscode.LanguageModelChatMessage[],
    params?: ModelInvokeParams,
    cancellationToken?: vscode.CancellationToken
  ): Promise<ModelResponse> {
    if (!this.model || !this.initialized) {
      throw new BuiltInProviderError('Provider not initialized. Call initialize() first.', 'NOT_INITIALIZED');
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
      
      // Collect response text for debug logging
      let responseText = '';
      const originalText = response.text;
      const provider = this;
      const debugText = async function* () {
        for await (const fragment of originalText) {
          responseText += fragment;
          yield fragment;
        }
        // Save debug info with response after completion
        await savePromptDebug(messages, provider, responseText);
      };
      
      return {
        text: debugText(),
        // VS Code doesn't provide token count in response
        totalTokens: undefined
      };
    } catch (error) {
      // Re-throw BuiltInProviderError instances
      if (error instanceof BuiltInProviderError) {
        throw error;
      }

      if (error instanceof vscode.LanguageModelError) {
        // Handle VS Code specific language model errors
        if (error.message.includes('consent') || error.message.includes('permission')) {
          throw BuiltInProviderError.consentRequired();
        } else if (error.message.includes('blocked') || error.message.includes('content policy')) {
          throw BuiltInProviderError.contentBlocked();
        } else if (error.message.includes('throttled') || error.message.includes('rate limit')) {
          throw BuiltInProviderError.rateLimited();
        } else {
          throw new BuiltInProviderError(`Built-in provider failed: ${error.message}`, 'UNKNOWN_VS_CODE_ERROR', error);
        }
      }
      
      throw new BuiltInProviderError(`Unexpected error: ${error}`, 'UNKNOWN_ERROR', error as Error);
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
