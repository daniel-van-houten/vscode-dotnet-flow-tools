import * as vscode from "vscode";
import { ProviderRegistry } from "./ProviderRegistry";
import { BuiltInProvider } from "./BuiltInProvider";
import { BedrockProvider } from "./BedrockProvider";
import { getCatalogModelsForProvider } from "./model-catalog";

import { parseCombinedModel, formatCombinedModel } from "./modelSetting";

export {
  IModelProvider,
  ModelInfo,
  ModelInvokeParams,
  ModelResponse,
} from "./IModelProvider";
export { ProviderRegistry } from "./ProviderRegistry";
export { BuiltInProvider } from "./BuiltInProvider";
export { BedrockProvider } from "./BedrockProvider";
export { CredentialManager } from "./credentials";

/**
 * Create and configure the provider registry with all available providers
 * @param context VS Code extension context
 * @returns Configured provider registry
 */
export function createProviderRegistry(
  context: vscode.ExtensionContext,
): ProviderRegistry {
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
  context: vscode.ExtensionContext,
): Promise<void> {
  // Prefer combined model key if present: "providerId|modelId"
  const combined = config.get<string>("model");
  let providerId = "built-in";
  let modelId = "";

  const parsed = parseCombinedModel(combined);
  if (parsed) {
    if (parsed.providerId) {
      providerId = parsed.providerId;
    }
    if (parsed.modelToken) {
      const models = getCatalogModelsForProvider(providerId);
      const byId = models.find((m) => m.id === parsed.modelToken);
      const byName = models.find((m) => m.name === parsed.modelToken);
      const chosen = byId ?? byName;
      modelId = chosen ? chosen.id : parsed.modelToken;
    }
  }
  // If combined setting is missing or invalid, proceed with sensible defaults.

  try {
    await registry.initializeProvider(providerId, config, modelId, context);
    console.log(
      `Provider system initialized with provider: ${providerId}, model: ${modelId || "none"}`,
    );
  } catch (error) {
    console.error("Failed to initialize provider system:", error);

    // Generic fallback to built-in provider for any initialization failure
    if (providerId !== "built-in" && registry.hasProvider("built-in")) {
      console.log("Falling back to built-in provider");
      try {
        await registry.initializeProvider("built-in", config, "", context);
        // Update configuration to reflect the fallback (combined key only)
        await config.update(
          "model",
          formatCombinedModel("built-in", ""),
          vscode.ConfigurationTarget.Global,
        );

        // Let the failed provider show its own fallback guidance
        const failedProvider = registry.getProvider(providerId);
        if (failedProvider && "showFallbackGuidance" in failedProvider) {
          (failedProvider as any).showFallbackGuidance();
        }
      } catch (fallbackError) {
        console.error("Failed to initialize fallback provider:", fallbackError);
        throw new Error(`Failed to initialize any provider: ${error}`);
      }
    } else {
      throw error;
    }
  }
}
