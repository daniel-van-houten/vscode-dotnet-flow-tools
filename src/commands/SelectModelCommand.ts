import * as vscode from 'vscode';
import { BaseCommand } from '../core/BaseCommand';
import { ILogger } from '../core/Logger';
import { ServiceContainer, ServiceKeys } from '../core/ServiceContainer';
import { IConfigService } from '../services/IConfigService';
import { ProviderRegistry } from '../providers/ProviderRegistry';
import { initializeProviderSystem } from '../providers';
import { suspendConfigWatcher } from '../core/ConfigWatcherGate';

/**
 * Command to select AI model for documentation generation
 */
export class SelectModelCommand extends BaseCommand {
  constructor(
    logger: ILogger,
    private readonly serviceContainer: ServiceContainer
  ) {
    super(logger);
  }

  protected async executeInternal(): Promise<void> {
    const configService = this.serviceContainer.get<IConfigService>(ServiceKeys.CONFIG_SERVICE);
    const providerRegistry = this.serviceContainer.get<ProviderRegistry>(ServiceKeys.PROVIDER_REGISTRY);
    const extensionContext = this.serviceContainer.get<vscode.ExtensionContext>('extensionContext');
    
    const config = configService.getConfig();
    const currentProvider = config.provider;
    const currentModelId = config.modelId;
    
    // Get all available providers
    const allProviderIds = providerRegistry.getProviderIds();
    
    if (allProviderIds.length === 0) {
      vscode.window.showWarningMessage(
        'No AI providers are available. Please check your extension configuration.',
        'Open Settings'
      ).then(selection => {
        if (selection === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'dotnetFlow');
        }
      });
      return;
    }

    // Collect models from all providers
    const allModels: Array<{
      id: string;
      name: string;
      description: string;
      providerId: string;
      providerName: string;
    }> = [];

    for (const providerId of allProviderIds) {
      try {
        const models = await providerRegistry.getModelsForProvider(providerId);
        const providerName = this.getProviderDisplayName(providerId);
        
        for (const model of models) {
          allModels.push({
            ...model,
            providerId,
            providerName
          });
        }
      } catch (error) {
        this.logger.error(`Failed to get models for provider ${providerId}:`, error instanceof Error ? error : new Error(String(error)));
      }
    }

    if (allModels.length === 0) {
      vscode.window.showWarningMessage(
        'No models are available from any provider. Please check your provider configurations.',
        'Open Settings'
      ).then(selection => {
        if (selection === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'dotnetFlow');
        }
      });
      return;
    }

    // Create quick pick items with provider information
    const pickItems = allModels.map(model => {
      const isCurrentSelection = model.providerId === currentProvider && model.id === currentModelId;
      const label = `${model.name} (${model.providerName})`;
      
      return {
        label: isCurrentSelection ? `$(check) ${label}` : label,
        detail: model.description,
        description: isCurrentSelection ? 'Currently selected' : '',
        id: model.id,
        providerId: model.providerId,
        providerName: model.providerName,
        modelName: model.name
      };
    });

    // Sort items: current selection first, then by provider, then by model name
    pickItems.sort((a, b) => {
      const aIsCurrent = a.label.startsWith('$(check)');
      const bIsCurrent = b.label.startsWith('$(check)');
      
      if (aIsCurrent && !bIsCurrent) {
        return -1;
      }
      if (!aIsCurrent && bIsCurrent) {
        return 1;
      }
      
      if (a.providerId !== b.providerId) {
        return a.providerId.localeCompare(b.providerId);
      }
      
      return a.modelName.localeCompare(b.modelName);
    });

    const picked = await vscode.window.showQuickPick(pickItems, {
      placeHolder: 'Choose an AI model from any provider',
      ignoreFocusOut: true,
      matchOnDetail: true,
      matchOnDescription: true
    });
    
    if (!picked) { 
      return; 
    }

    // Validate provider type and update configuration
    const validProviders = ['built-in', 'bedrock'] as const;
    if (!validProviders.includes(picked.providerId as any)) {
      vscode.window.showErrorMessage(
        `Provider '${picked.providerId}' is not supported. Supported providers: ${validProviders.join(', ')}`
      );
      return;
    }

    // Suspend watcher while applying both values programmatically
    const resume = suspendConfigWatcher();
    try {
      await configService.update('modelId', picked.id);
      await configService.update('provider', picked.providerId as 'built-in' | 'bedrock');
    } finally {
      resume();
    }
    
    // Reinitialize provider with new model
    const workspaceConfig = vscode.workspace.getConfiguration('dotnetFlow');
    await initializeProviderSystem(providerRegistry, workspaceConfig, extensionContext);

    vscode.window.showInformationMessage(
      `✅ Will use ${picked.modelName} from ${picked.providerName} for future documentation runs.`
    );
  }

  /**
   * Get display name for a provider ID
   */
  private getProviderDisplayName(providerId: string): string {
    const displayNames: Record<string, string> = {
      'bedrock': 'AWS Bedrock',
      'built-in': 'VS Code Built-in',
      'openai': 'OpenAI',
      'azure': 'Azure OpenAI'
    };
    
    return displayNames[providerId] || providerId;
  }
}
