import * as vscode from 'vscode';
import { ITokenManager } from './ITokenManager';

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  vendor?: string;
  version?: string;
}

export interface ModelInvokeParams {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  modelOptions?: any;
}

export interface ModelResponse {
  text: AsyncIterable<string>;
  totalTokens?: number;
}

export interface IModelProvider {
  /**
   * Provider identifier
   */
  readonly id: string;

  /**
   * Initialize the provider with configuration and model ID
   * @param config VS Code workspace configuration
   * @param modelId The specific model ID to use
   * @param context Optional extension context for accessing secrets
   */
  initialize(
    config: vscode.WorkspaceConfiguration, 
    modelId: string,
    context?: vscode.ExtensionContext
  ): Promise<void>;

  /**
   * List available models for this provider
   * @returns Array of available models
   */
  listModels(): Promise<ModelInfo[]>;

  /**
   * Invoke the model with a prompt
   * @param messages Array of chat messages
   * @param params Optional parameters for model invocation
   * @param cancellationToken Optional cancellation token
   * @returns Model response
   */
  invoke(
    messages: vscode.LanguageModelChatMessage[],
    params?: ModelInvokeParams,
    cancellationToken?: vscode.CancellationToken
  ): Promise<ModelResponse>;

  /**
   * Dispose of any resources
   */
  dispose(): void;

  /**
   * Check if the provider is properly initialized
   */
  isInitialized(): boolean;

  /**
   * Get the token manager for this provider
   */
  readonly tokenManager: ITokenManager;

  /**
   * Get the current model ID that was set during initialization
   */
  readonly currentModelId: string;
}