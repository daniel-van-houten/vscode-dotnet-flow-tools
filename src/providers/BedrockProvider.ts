import * as vscode from 'vscode';
import { IModelProvider, ModelInfo, ModelInvokeParams, ModelResponse } from './IModelProvider';
import { RateLimiter } from './RateLimiter';
import { BedrockTokenManager } from './BedrockTokenManager';
import { BedrockProviderError } from '../core/ErrorTypes';
import { savePromptDebug } from '../core/DebugLogger';
import { getCatalogModelsForProvider } from './model-catalog';

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';

export class BedrockProvider implements IModelProvider {
  readonly id = 'bedrock';
  private client: BedrockRuntimeClient | null = null;
  private modelId: string = '';
  private initialized = false;
  // Note: Credential manager reserved for future AWS credential management
  private rateLimiter: RateLimiter;
  readonly tokenManager = new BedrockTokenManager();

  // Models sourced from centralized catalog
  private static get MODELS(): ModelInfo[] {
    return getCatalogModelsForProvider('bedrock');
  }

  constructor() {
    this.rateLimiter = RateLimiter.getInstance(1); // Conservative rate limiting for Bedrock
  }

  get currentModelId(): string {
    return this.modelId;
  }

  async initialize(
    config: vscode.WorkspaceConfiguration,
    modelId: string,
    context?: vscode.ExtensionContext
  ): Promise<void> {
    // Validate model ID only if one is provided
    if (modelId && !BedrockProvider.MODELS.some(m => m.id === modelId)) {
      throw BedrockProviderError.modelNotFound(modelId);
    }

    // If no model is selected, don't initialize AWS client yet but show helpful guidance
    if (!modelId || modelId.trim() === '') {
      this.modelId = '';
      this.initialized = true;
      console.log('Bedrock provider initialized without model selection - AWS client will be created when model is selected');
      
      return;
    }

    const region = config.get<string>('awsRegion', 'us-east-1');
    const profile = config.get<string>('awsProfile', 'default');

    // Store configuration for later use but don't validate credentials during initialization
    // Credentials will be validated when actually invoking the model

    try {
      const clientConfig = {
        region,
        credentials: fromIni({ profile })
      };
      this.client = new BedrockRuntimeClient(clientConfig);

      this.modelId = modelId;
      this.initialized = true;

      console.log(`Bedrock provider initialized with model: ${modelId}, region: ${region}`);
    } catch (error) {
      if (error instanceof BedrockProviderError) {
        throw error;
      }
      
      // Handle credential-specific errors more gracefully
      if (error instanceof Error && error.message.includes('Could not resolve credentials')) {
        throw BedrockProviderError.credentialsNotConfigured();
      }
      
      throw new BedrockProviderError(`Failed to initialize Bedrock client: ${error}`, 'INITIALIZATION_FAILED', error as Error);
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    // Return the catalog models
    return BedrockProvider.MODELS;
  }

  async invoke(
    messages: vscode.LanguageModelChatMessage[],
    params?: ModelInvokeParams
  ): Promise<ModelResponse> {
    if (!this.initialized) {
      throw new BedrockProviderError('Bedrock provider not initialized. Call initialize() first.', 'NOT_INITIALIZED');
    }

    if (!this.modelId || this.modelId.trim() === '') {
      throw BedrockProviderError.modelNotSelected();
    }

    // Initialize AWS client now if it wasn't done during initialization (model was selected later)
    if (!this.client) {
      throw new BedrockProviderError('AWS client not initialized. This may indicate a configuration issue.', 'CLIENT_NOT_INITIALIZED');
    }

    // Validate credentials before making the actual call
    // This is where we check if the user has configured AWS credentials
    // For now, we'll just show a helpful error message since the AWS SDK isn't installed yet

    // Convert VS Code messages to Bedrock format
    const converseMessages = messages.map(msg => {
      // Convert VS Code's complex content array to simple text
      let textContent = '';
      if (typeof msg.content === 'string') {
        textContent = msg.content;
      } else {
        // Handle array of content parts
        textContent = msg.content.map(part => {
          if ('value' in part) {
            return part.value;
          }
          // For other part types, try to extract text content
          return '';
        }).join('');
      }

      return {
        role: msg.role === vscode.LanguageModelChatMessageRole.User ? 'user' as const : 'assistant' as const,
        content: [{ text: textContent }]
      };
    });

    // Use model's max output tokens if not specified in params
    const maxOutputTokens = this.tokenManager.getMaxOutputTokens(this.modelId);

    const command = new ConverseCommand({
      modelId: this.modelId,
      messages: converseMessages,
      inferenceConfig: {
        maxTokens: params?.maxTokens ?? maxOutputTokens,
        temperature: params?.modelOptions.temperature ?? 0.7,
        topP: params?.topP ?? 0.9,
        stopSequences: params?.stopSequences
      }
    });

    try {
      if (!this.client) {
        throw new BedrockProviderError('Bedrock client not initialized', 'CLIENT_NOT_INITIALIZED');
      }

      const response = await this.rateLimiter.add(() => this.client!.send(command));

      const text = response.output?.message?.content?.[0]?.text || '';

      // Convert to async iterable to match VS Code's format
      const provider = this;
      const textIterable = async function* () {
        yield text;
        // Save debug info with response after completion
        await savePromptDebug(messages, provider, text);
      };

      return {
        text: textIterable(),
        totalTokens: (response as any)?.usage?.totalTokens
      };
    } catch (error: any) {
      // Re-throw BedrockProviderError instances
      if (error instanceof BedrockProviderError) {
        throw error;
      }

      // Handle AWS Bedrock-specific errors
      if (error.name === 'ResourceNotFoundException') {
        throw BedrockProviderError.modelNotFound(this.modelId);
      } else if (error.name === 'ThrottlingException') {
        // Implement exponential backoff for throttling
        const delay = Math.min(1000 * Math.pow(2, Math.floor(Math.random() * 4)), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
        throw BedrockProviderError.throttled();
      } else if (error.name === 'ValidationException') {
        throw BedrockProviderError.invalidRequest(error.message);
      } else if (error.name === 'AccessDeniedException') {
        throw BedrockProviderError.accessDenied();
      } else if (error.name === 'UnauthorizedException' || error.name === 'TokenRefreshRequiredException') {
        throw BedrockProviderError.tokenExpired();
      } else if (error.name === 'InternalServerException') {
        throw BedrockProviderError.serviceUnavailable();
      } else {
        throw new BedrockProviderError(`Bedrock provider error: ${error.message}`, 'UNKNOWN_ERROR', error);
      }
    }
  }

  dispose(): void {
    this.client = null;
    this.initialized = false;
    this.modelId = '';
  }

  isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }




  /**
   * Shows user-friendly guidance when this provider fails and system falls back to built-in
   */
  showFallbackGuidance(): void {
    vscode.window.showWarningMessage(
      'Bedrock provider setup incomplete. You can select a Bedrock model and configure AWS credentials later.',
      'Select AI Model',
      'Configure AWS'
    ).then(selection => {
      if (selection === 'Select AI Model') {
        vscode.commands.executeCommand('dotnet-flow-tools.selectModel');
      } else if (selection === 'Configure AWS') {
        vscode.env.openExternal(vscode.Uri.parse('https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html'));
      }
    });
  }
}
