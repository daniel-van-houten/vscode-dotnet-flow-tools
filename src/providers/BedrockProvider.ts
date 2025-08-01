import * as vscode from 'vscode';
import { IModelProvider, ModelInfo, ModelInvokeParams, ModelResponse } from './IModelProvider';
import { RateLimiter } from './RateLimiter';
import { BedrockTokenManager } from './BedrockTokenManager';
import { BedrockProviderError } from '../core/ErrorTypes';
import { savePromptDebug } from '../core/DebugLogger';

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

  // Hardcoded list of Bedrock models as per spec
  private static readonly MODELS: ModelInfo[] = [
    { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0', name: 'Claude Sonnet 4', description: 'Anthropic - Claude Sonnet 4' },
    { id: 'us.anthropic.claude-3-5-sonnet-20240620-v1:0', name: 'Claude Sonnet 3.5', description: 'Anthropic - Claude Sonnet 3.5' },
  ];

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
      
      // Show user-friendly guidance for model selection
      this.showModelSelectionGuidance();
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
        this.showCredentialConfigurationGuidance();
        throw BedrockProviderError.credentialsNotConfigured();
      }
      
      throw new BedrockProviderError(`Failed to initialize Bedrock client: ${error}`, 'INITIALIZATION_FAILED', error as Error);
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    // Return the static list of models
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
      this.showModelNotSelectedGuidance();
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
        temperature: params?.temperature ?? 0.7,
        topP: params?.topP ?? 0.9,
        stopSequences: params?.stopSequences
      }
    });

    try {
      if (!this.client) {
        throw new BedrockProviderError('Bedrock client not initialized', 'CLIENT_NOT_INITIALIZED');
      }

      // Save debug info before making the request
      await savePromptDebug(messages, this);

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
   * Shows user-friendly guidance for selecting a Bedrock model
   */
  private showModelSelectionGuidance(): void {
    vscode.window.showInformationMessage(
      'Bedrock provider is ready. Use the "Select AI Model" command to choose a model before generating documentation.',
      'Select AI Model'
    ).then(selection => {
      if (selection === 'Select AI Model') {
        vscode.commands.executeCommand('dotnet-flow-tools.selectModel');
      }
    });
  }

  /**
   * Shows user-friendly guidance for credential configuration issues
   */
  private showCredentialConfigurationGuidance(): void {
    vscode.window.showWarningMessage(
      'AWS credentials not configured for Bedrock. Configure credentials or select a different provider.',
      'Select Different Provider',
      'Configure AWS'
    ).then(selection => {
      if (selection === 'Select Different Provider') {
        vscode.commands.executeCommand('dotnet-flow-tools.selectModel');
      } else if (selection === 'Configure AWS') {
        vscode.env.openExternal(vscode.Uri.parse('https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html'));
      }
    });
  }

  /**
   * Shows user-friendly guidance when no model is selected during usage
   */
  private showModelNotSelectedGuidance(): void {
    vscode.window.showInformationMessage(
      'No AI model selected. Please select a Bedrock model to use this provider.',
      'Select AI Model',
      'Use Built-in Provider'
    ).then(selection => {
      if (selection === 'Select AI Model') {
        vscode.commands.executeCommand('dotnet-flow-tools.selectModel');
      } else if (selection === 'Use Built-in Provider') {
        vscode.workspace.getConfiguration('dotnetFlow').update('provider', 'built-in', vscode.ConfigurationTarget.Global);
      }
    });
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
