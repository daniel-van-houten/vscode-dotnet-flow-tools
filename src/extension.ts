import * as vscode from "vscode";
import { setupServices } from "./core/ServiceSetup";
import { ServiceContainer, ServiceKeys } from "./core/ServiceContainer";
import { CommandRegistry } from "./commands/CommandRegistry";
import { initializeProviderSystem, ProviderRegistry } from "./providers";
import { isConfigWatcherSuspended } from "./core/ConfigWatcherGate";
import { ILogger } from "./core/Logger";
import { ContentLoader } from "./prompts/template-builder/content-loader";
import {
  formatCombinedModel,
  normalizeCombinedModel,
} from "./providers/modelSetting";

// Global service container
let serviceContainer: ServiceContainer;
let commandRegistry: CommandRegistry;

export async function activate(context: vscode.ExtensionContext) {
  // Initialize content loader with extension context
  ContentLoader.initialize(context);

  // Setup services
  serviceContainer = setupServices(context);
  const logger = serviceContainer.get<ILogger>(ServiceKeys.LOGGER);

  try {
    // Initialize provider system
    const providerRegistry = serviceContainer.get<ProviderRegistry>(
      ServiceKeys.PROVIDER_REGISTRY,
    );

    // Migrate deprecated settings
    await migrateDeprecatedSettings();

    // Initialize provider system with current configuration
    await initializeProviderSystem(
      providerRegistry,
      vscode.workspace.getConfiguration("dotnetFlow"),
      context,
    ).catch((err) => {
      logger.error("Failed to initialize provider system", err);
      vscode.window.showErrorMessage(
        "Failed to initialize AI provider system.",
      );
    });


    // Setup configuration change watcher
    setupConfigurationWatcher(context, providerRegistry, logger);

    // Register commands
    commandRegistry = new CommandRegistry(serviceContainer);
    commandRegistry.registerWithVSCode(context);

    logger.info("Dotnet Flow Tools extension activated successfully");
  } catch (error) {
    logger.error(
      "Failed to activate extension",
      error instanceof Error ? error : new Error(String(error)),
    );
    vscode.window.showErrorMessage(
      "Failed to activate Dotnet Flow Tools extension.",
    );
  }
}

/**
 * Setup configuration change watcher
 */
function setupConfigurationWatcher(
  context: vscode.ExtensionContext,
  providerRegistry: ProviderRegistry,
  logger: ILogger,
): void {
  const configWatcher = vscode.workspace.onDidChangeConfiguration(
    async (event) => {
      if (
        event.affectsConfiguration("dotnetFlow.model") ||
        event.affectsConfiguration("dotnetFlow.awsProfile") ||
        event.affectsConfiguration("dotnetFlow.awsRegion")
      ) {
        if (isConfigWatcherSuspended()) {
          logger.info("Config watcher suspended; skipping reinitialization");
          return;
        }
        try {
          const dotnetFlowConfig =
            vscode.workspace.getConfiguration("dotnetFlow");
          if (event.affectsConfiguration("dotnetFlow.model")) {
            const combined = dotnetFlowConfig.get<string>("model");
            // Normalize to canonical "provider | model" format
            const normalized = normalizeCombinedModel(combined);
            if (normalized && normalized !== combined) {
              await dotnetFlowConfig.update(
                "model",
                normalized,
                vscode.ConfigurationTarget.Global,
              );
            }
          }
          await initializeProviderSystem(
            providerRegistry,
            dotnetFlowConfig,
            context,
          );
          logger.info(
            "Provider system reinitialized due to configuration change",
          );
        } catch (err) {
          logger.error(
            "Failed to reinitialize provider system",
            err instanceof Error ? err : new Error(String(err)),
          );
          vscode.window.showErrorMessage(
            "Failed to reinitialize AI provider system.",
          );
        }
      }
    },
  );

  context.subscriptions.push(configWatcher);
}


/**
 * Simple migration for deprecated settings
 */
async function migrateDeprecatedSettings(): Promise<void> {
  const config = vscode.workspace.getConfiguration("dotnetFlow");

  const preferredVendor = config.get<string>("preferredVendor");
  const preferredModelId = config.get<string>("preferredModelId");
  const provider = (config.get<string>("provider") ?? "").trim();
  const modelId = (config.get<string>("modelId") ?? "").trim();
  const combined = config.get<string>("model");

  // Normalize existing combined value to canonical "provider | model" (trim tokens)
  const normalized = normalizeCombinedModel(combined);
  if (normalized && normalized !== combined) {
    await config.update("model", normalized, vscode.ConfigurationTarget.Global);
  }

  // Maintain deprecated migrations for older users, but target combined key
  if (preferredVendor && !provider && !combined) {
    await config.update(
      "model",
      formatCombinedModel("built-in", preferredModelId ?? ""),
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      "preferredVendor",
      undefined,
      vscode.ConfigurationTarget.Global,
    );
  }
  if (preferredModelId && !modelId && !combined) {
    await config.update(
      "model",
      formatCombinedModel(provider || "built-in", preferredModelId),
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      "preferredModelId",
      undefined,
      vscode.ConfigurationTarget.Global,
    );
  }

  // New migration: keep combined and legacy keys in sync
  // If combined is missing but legacy keys exist, create combined
  if (!combined && (provider || modelId)) {
    const combinedValue = formatCombinedModel(provider, modelId);
    await config.update(
      "model",
      combinedValue,
      vscode.ConfigurationTarget.Global,
    );
  }
}

export function deactivate() {
  if (serviceContainer) {
    const providerRegistry = serviceContainer.get<ProviderRegistry>(
      ServiceKeys.PROVIDER_REGISTRY,
    );
    providerRegistry.dispose();
    serviceContainer.clear();
  }
}
