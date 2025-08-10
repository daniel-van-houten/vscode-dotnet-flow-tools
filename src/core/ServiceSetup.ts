import * as vscode from "vscode";
import { ServiceContainer, ServiceKeys } from "./ServiceContainer";
import { ConsoleLogger, ILogger } from "./Logger";
import { ConfigService } from "../services/ConfigService";
import { CliService } from "../services/CliService";
import { FileService } from "../services/FileService";
import { SymbolService } from "../services/SymbolService";
import { TraceService } from "../services/TraceService";
import { createProviderRegistry } from "../providers";

/**
 * Setup and configure all services in the container
 */
export function setupServices(
  context: vscode.ExtensionContext,
): ServiceContainer {
  const container = new ServiceContainer();

  // Register core services
  container.register<ILogger>(ServiceKeys.LOGGER, new ConsoleLogger());
  container.register<vscode.ExtensionContext>(
    ServiceKeys.EXTENSION_CONTEXT,
    context,
  );

  // Register application services
  container.register(ServiceKeys.CONFIG_SERVICE, new ConfigService());
  container.register(ServiceKeys.CLI_SERVICE, new CliService());
  container.register(ServiceKeys.FILE_SERVICE, new FileService());
  container.register(ServiceKeys.SYMBOL_SERVICE, new SymbolService());
  container.register(ServiceKeys.TRACE_SERVICE, new TraceService());

  // Register provider registry
  container.register(
    ServiceKeys.PROVIDER_REGISTRY,
    createProviderRegistry(context),
  );

  return container;
}
