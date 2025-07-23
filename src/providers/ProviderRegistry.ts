import * as vscode from 'vscode';
import { IModelProvider } from './IModelProvider';

export class ProviderRegistry {
  private providers = new Map<string, IModelProvider>();
  private currentProvider: IModelProvider | null = null;

  /**
   * Register a provider
   * @param provider The provider to register
   */
  register(provider: IModelProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Get a provider by ID
   * @param id Provider ID
   * @returns The provider or undefined if not found
   */
  getProvider(id: string): IModelProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered provider IDs
   * @returns Array of provider IDs
   */
  getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Initialize and set the current provider
   * @param providerId Provider ID to use
   * @param config VS Code workspace configuration
   * @param modelId Model ID to initialize with
   * @param context Extension context
   */
  async initializeProvider(
    providerId: string,
    config: vscode.WorkspaceConfiguration,
    modelId: string,
    context: vscode.ExtensionContext
  ): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found. Available providers: ${this.getProviderIds().join(', ')}`);
    }

    // Dispose current provider if exists
    if (this.currentProvider) {
      this.currentProvider.dispose();
    }

    // Initialize new provider
    await provider.initialize(config, modelId, context);
    this.currentProvider = provider;
  }

  /**
   * Get the current active provider
   * @returns The current provider or null if none is active
   */
  getCurrentProvider(): IModelProvider | null {
    return this.currentProvider;
  }

  /**
   * Dispose all providers
   */
  dispose(): void {
    this.providers.forEach(provider => provider.dispose());
    this.providers.clear();
    this.currentProvider = null;
  }

  /**
   * Check if a provider is registered
   * @param id Provider ID
   * @returns True if provider is registered
   */
  hasProvider(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * Get list of models for a specific provider
   * @param providerId Provider ID
   * @returns Array of models or empty array if provider not found
   */
  async getModelsForProvider(providerId: string): Promise<Array<{ id: string; name: string; description: string }>> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return [];
    }

    try {
      return await provider.listModels();
    } catch (error) {
      console.error(`Failed to get models for provider ${providerId}:`, error);
      return [];
    }
  }
}