import * as vscode from "vscode";
import { ITraceService } from "../services/ITraceService";
import { BaseCommand } from "../core/BaseCommand";
import { ILogger } from "../core/Logger";
import { ServiceContainer, ServiceKeys } from "../core/ServiceContainer";
import { ICliService } from "../services/ICliService";
import { IFileService } from "../services/IFileService";
import { ISymbolService } from "../services/ISymbolService";
import { IConfigService } from "../services/IConfigService";
import { ResourceNotFoundError, ValidationError } from "../core/ErrorTypes";
import { FILE_PATTERNS } from "../config/ConfigConstants";

/**
 * Trace generation strategy
 */
export interface ITraceStrategy {
  /**
   * Get CLI arguments for this trace type
   */
  getCliArgs(): string[];

  /**
   * Get display name for this trace type
   */
  getDisplayName(): string;
}

/**
 * Strategy for generating all traces (full detail)
 */
export class AllTracesStrategy implements ITraceStrategy {
  getCliArgs(): string[] {
    return [];
  }

  getDisplayName(): string {
    return "All Traces (Full Detail)";
  }
}

/**
 * Strategy for generating methods-only traces
 */
export class MethodsOnlyStrategy implements ITraceStrategy {
  getCliArgs(): string[] {
    return ["--methods-only"];
  }

  getDisplayName(): string {
    return "Methods Only";
  }
}

/**
 * Strategy for generating MediatR handlers only
 */
export class MediatrOnlyStrategy implements ITraceStrategy {
  getCliArgs(): string[] {
    return ["--handlers-only"];
  }

  getDisplayName(): string {
    return "MediatR Handlers Only";
  }
}

/**
 * Command to generate code traces with different verbosity levels
 */
export class TraceCommand extends BaseCommand {
  constructor(
    logger: ILogger,
    private readonly serviceContainer: ServiceContainer,
    private readonly strategy: ITraceStrategy,
  ) {
    super(logger);
  }

  protected async executeInternal(): Promise<void> {
    await this.withProgress(
      `${this.strategy.getDisplayName()}`,
      async (progress, token) => {
        const editor = this.validateActiveEditor();

        const symbolService = this.serviceContainer.get<ISymbolService>(
          ServiceKeys.SYMBOL_SERVICE,
        );
        const fileService = this.serviceContainer.get<IFileService>(
          ServiceKeys.FILE_SERVICE,
        );
        const cliService = this.serviceContainer.get<ICliService>(
          ServiceKeys.CLI_SERVICE,
        );
        const configService = this.serviceContainer.get<IConfigService>(
          ServiceKeys.CONFIG_SERVICE,
        );
        const traceService = this.serviceContainer.get<ITraceService>(
          ServiceKeys.TRACE_SERVICE,
        );
        const extensionContext =
          this.serviceContainer.get<vscode.ExtensionContext>(
            ServiceKeys.EXTENSION_CONTEXT,
          );

        progress.report({
          increment: 20,
          message: "Analyzing code structure...",
        });

        const symbolInfo = await symbolService.findMethodAtPosition(
          editor.document,
          editor.selection.active,
        );
        if (!symbolInfo) {
          throw new ValidationError(
            "Put cursor inside a method within a class.",
          );
        }

        const solutions = await fileService.findFiles(
          FILE_PATTERNS.SOLUTION,
          undefined,
          1,
        );
        if (solutions.length === 0) {
          throw new ResourceNotFoundError(
            "Solution (.sln) not found",
            "solution",
          );
        }

        if (token.isCancellationRequested) {
          return;
        }

        progress.report({ increment: 50, message: "Generating trace..." });

        const raw = await traceService.generateTrace(
          cliService,
          configService,
          extensionContext.extensionPath,
          solutions[0],
          symbolInfo.class.name,
          symbolInfo.method.name,
          "graph",
          this.strategy.getCliArgs(),
        );
        const trace = raw
          .replace(/<!--CALL-GRAPH-BEGIN-->/g, "")
          .replace(/<!--CALL-GRAPH-END-->/g, "")
          .trim();

        if (token.isCancellationRequested) {
          return;
        }

        progress.report({
          increment: 90,
          message: "Opening trace document...",
        });

        // Open trace in a new document
        const document = await vscode.workspace.openTextDocument({
          content: trace,
          language: "markdown",
        });

        await vscode.window.showTextDocument(document, { preview: false });

        progress.report({
          increment: 100,
          message: "Trace generation complete!",
        });
      },
    );
  }

  // Trace generation delegated to TraceService
}
