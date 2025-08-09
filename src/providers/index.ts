import * as vscode from 'vscode';
import { ProviderRegistry } from './ProviderRegistry';
import { BuiltInProvider } from './BuiltInProvider';
import { BedrockProvider } from './BedrockProvider';

export { IModelProvider, ModelInfo, ModelInvokeParams, ModelResponse } from './IModelProvider';
export { ProviderRegistry } from './ProviderRegistry';
export { BuiltInProvider } from './BuiltInProvider';
export { BedrockProvider } from './BedrockProvider';
export { CredentialManager } from './credentials';

/**
 * Create and configure the provider registry with all available providers
 * @param context VS Code extension context
 * @returns Configured provider registry
 */
export function createProviderRegistry(context: vscode.ExtensionContext): ProviderRegistry {
  const registry = new ProviderRegistry();
  
  // Register built-in provider
  registry.register(new BuiltInProvider());
  
  // Register Bedrock provider
  registry.register(new BedrockProvider());
  
  return registry;
}

/**
 * Initialize the provider system with the current configuration
 * @param registry Provider registry
 * @param config VS Code workspace configuration
 * @param context Extension context
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeProviderSystem(
  registry: ProviderRegistry,
  config: vscode.WorkspaceConfiguration,
  context: vscode.ExtensionContext
): Promise<void> {
  const providerId = config.get<string>('provider', 'built-in');
  const modelId = config.get<string>('modelId', '');

  try {
    await registry.initializeProvider(providerId, config, modelId, context);
    console.log(`Provider system initialized with provider: ${providerId}, model: ${modelId || 'none'}`);
  } catch (error) {
    console.error('Failed to initialize provider system:', error);

    // Generic fallback to built-in provider for any initialization failure
    if (providerId !== 'built-in' && registry.hasProvider('built-in')) {
      console.log('Falling back to built-in provider');
      try {
        await registry.initializeProvider('built-in', config, '', context);
        
        // Update configuration to reflect the fallback
        await config.update('provider', 'built-in', vscode.ConfigurationTarget.Global);
        
        // Let the failed provider show its own fallback guidance
        const failedProvider = registry.getProvider(providerId);
        if (failedProvider && 'showFallbackGuidance' in failedProvider) {
          (failedProvider as any).showFallbackGuidance();
        }
      } catch (fallbackError) {
        console.error('Failed to initialize fallback provider:', fallbackError);
        throw new Error(`Failed to initialize any provider: ${error}`);
      }
    } else {
      throw error;
    }
  }
}