import * as vscode from 'vscode';
import { setupServices } from './core/ServiceSetup';
import { ServiceContainer, ServiceKeys } from './core/ServiceContainer';
import { CommandRegistry } from './commands/CommandRegistry';
import { initializeProviderSystem, ProviderRegistry } from './providers';
import { ILogger } from './core/Logger';

// Global service container
let serviceContainer: ServiceContainer;
let commandRegistry: CommandRegistry;

export async function activate(context: vscode.ExtensionContext) {
  // Setup services
  serviceContainer = setupServices(context);
  const logger = serviceContainer.get<ILogger>(ServiceKeys.LOGGER);
  
  try {
    // Initialize provider system
    const providerRegistry = serviceContainer.get<ProviderRegistry>(ServiceKeys.PROVIDER_REGISTRY);
    
    // Migrate deprecated settings
    await migrateDeprecatedSettings();
    
    // Initialize provider system with current configuration
    await initializeProviderSystem(providerRegistry, vscode.workspace.getConfiguration('dotnetFlow'), context)
      .catch(err => {
        logger.error('Failed to initialize provider system', err);
        vscode.window.showErrorMessage('Failed to initialize AI provider system.');
      });
    
    // Setup configuration change watcher
    setupConfigurationWatcher(context, providerRegistry, logger);
    
    // Register commands
    commandRegistry = new CommandRegistry(serviceContainer);
    commandRegistry.registerWithVSCode(context);
    
    logger.info('Dotnet Flow Tools extension activated successfully');
  } catch (error) {
    logger.error('Failed to activate extension', error instanceof Error ? error : new Error(String(error)));
    vscode.window.showErrorMessage('Failed to activate Dotnet Flow Tools extension.');
  }
}

/**
 * Setup configuration change watcher
 */
function setupConfigurationWatcher(
  context: vscode.ExtensionContext,
  providerRegistry: ProviderRegistry,
  logger: ILogger
): void {
  const configWatcher = vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (event.affectsConfiguration('dotnetFlow.provider') || 
        event.affectsConfiguration('dotnetFlow.modelId') ||
        event.affectsConfiguration('dotnetFlow.awsProfile') ||
        event.affectsConfiguration('dotnetFlow.awsRegion')) {
      try {
        await initializeProviderSystem(providerRegistry, vscode.workspace.getConfiguration('dotnetFlow'), context);
        logger.info('Provider system reinitialized due to configuration change');
      } catch (err) {
        logger.error('Failed to reinitialize provider system', err instanceof Error ? err : new Error(String(err)));
        vscode.window.showErrorMessage('Failed to reinitialize AI provider system.');
      }
    }
  });
  
  context.subscriptions.push(configWatcher);
}



/**
 * Simple migration for deprecated settings
 */
async function migrateDeprecatedSettings(): Promise<void> {
  const config = vscode.workspace.getConfiguration('dotnetFlow');
  
  const preferredVendor = config.get<string>('preferredVendor');
  const preferredModelId = config.get<string>('preferredModelId');
  
  if (preferredVendor && !config.get<string>('provider')) {
    await config.update('provider', 'built-in', vscode.ConfigurationTarget.Global);
    await config.update('preferredVendor', undefined, vscode.ConfigurationTarget.Global);
  }
  
  if (preferredModelId && !config.get<string>('modelId')) {
    await config.update('modelId', preferredModelId, vscode.ConfigurationTarget.Global);
    await config.update('preferredModelId', undefined, vscode.ConfigurationTarget.Global);
  }
}

export function deactivate() {
  if (serviceContainer) {
    const providerRegistry = serviceContainer.get<ProviderRegistry>(ServiceKeys.PROVIDER_REGISTRY);
    providerRegistry.dispose();
    serviceContainer.clear();
  }
}

