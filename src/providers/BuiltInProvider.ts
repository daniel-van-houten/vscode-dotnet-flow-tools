import * as vscode from 'vscode';
import { IModelProvider, ModelInfo, ModelInvokeParams, ModelResponse } from './IModelProvider';
import { BuiltInTokenManager } from './BuiltInTokenManager';
import { BuiltInProviderError } from '../core/ErrorTypes';

export class BuiltInProvider implements IModelProvider {
  readonly id = 'built-in';
  private model: vscode.LanguageModelChat | null = null;
  private initialized = false;
  readonly tokenManager = new BuiltInTokenManager();

  // Static list of commonly available VS Code language models
  private static readonly MODELS: ModelInfo[] = [
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
        this.showModelUnavailableGuidance();
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
          this.showModelUnavailableGuidance(modelId);
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
      
      return {
        text: response.text,
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
          this.showConsentRequiredGuidance();
          throw BuiltInProviderError.consentRequired();
        } else if (error.message.includes('blocked') || error.message.includes('content policy')) {
          this.showContentBlockedGuidance();
          throw BuiltInProviderError.contentBlocked();
        } else if (error.message.includes('throttled') || error.message.includes('rate limit')) {
          this.showRateLimitedGuidance();
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

  /**
   * Shows user-friendly guidance when no models are available
   */
  private showModelUnavailableGuidance(modelId?: string): void {
    const message = modelId 
      ? `Model '${modelId}' is not available. Please ensure GitHub Copilot is installed and active.`
      : 'No language models are available. Please ensure GitHub Copilot is installed and active.';
    
    vscode.window.showWarningMessage(
      message,
      'Install Copilot',
      'Select Different Provider'
    ).then(selection => {
      if (selection === 'Install Copilot') {
        vscode.env.openExternal(vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=GitHub.copilot'));
      } else if (selection === 'Select Different Provider') {
        vscode.commands.executeCommand('dotnet-flow-tools.selectModel');
      }
    });
  }

  /**
   * Shows user-friendly guidance for consent/permission issues
   */
  private showConsentRequiredGuidance(): void {
    vscode.window.showWarningMessage(
      'Please give consent to use AI features in VS Code. You can enable this in VS Code settings under AI features.',
      'Open Settings',
      'Select Different Provider'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'github.copilot');
      } else if (selection === 'Select Different Provider') {
        vscode.commands.executeCommand('dotnet-flow-tools.selectModel');
      }
    });
  }

  /**
   * Shows user-friendly guidance for content policy violations
   */
  private showContentBlockedGuidance(): void {
    vscode.window.showWarningMessage(
      'Request was blocked by content policy. Please try with different content.',
      'Try Again',
      'Select Different Provider'
    ).then(selection => {
      if (selection === 'Select Different Provider') {
        vscode.commands.executeCommand('dotnet-flow-tools.selectModel');
      }
    });
  }

  /**
   * Shows user-friendly guidance for rate limiting issues
   */
  private showRateLimitedGuidance(): void {
    vscode.window.showWarningMessage(
      'Too many requests to VS Code language models. Please wait a moment and try again.',
      'Select Different Provider'
    ).then(selection => {
      if (selection === 'Select Different Provider') {
        vscode.commands.executeCommand('dotnet-flow-tools.selectModel');
      }
    });
  }

  /**
   * Shows user-friendly guidance when this provider is used as fallback
   */
  showFallbackGuidance(): void {
    vscode.window.showInformationMessage(
      'Using built-in VS Code language models. You can select a different provider later if needed.',
      'Select Different Provider'
    ).then(selection => {
      if (selection === 'Select Different Provider') {
        vscode.commands.executeCommand('dotnet-flow-tools.selectModel');
      }
    });
  }
}