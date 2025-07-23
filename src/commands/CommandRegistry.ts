import * as vscode from 'vscode';
import { ICommand } from '../core/ICommand';
import { ILogger } from '../core/Logger';
import { ServiceContainer, ServiceKeys } from '../core/ServiceContainer';
import { DocumentThisCommand } from './DocumentThisCommand';
import { SelectModelCommand } from './SelectModelCommand';
import { TraceCommand, AllTracesStrategy, MethodsOnlyStrategy, MediatrOnlyStrategy } from './TraceCommand';
import { COMMANDS } from '../config/ConfigConstants';

/**
 * Registry for managing and executing commands
 */
export class CommandRegistry {
  private readonly commands = new Map<string, ICommand>();

  constructor(private readonly serviceContainer: ServiceContainer) {
    this.registerCommands();
  }

  /**
   * Register all extension commands
   */
  private registerCommands(): void {
    const logger = this.serviceContainer.get<ILogger>(ServiceKeys.LOGGER);

    // Document This command
    this.commands.set(
      COMMANDS.DOCUMENT_THIS,
      new DocumentThisCommand(logger, this.serviceContainer)
    );

    // Select Model command
    this.commands.set(
      COMMANDS.SELECT_MODEL,
      new SelectModelCommand(logger, this.serviceContainer)
    );

    // Trace commands with different strategies
    this.commands.set(
      COMMANDS.TRACE_ALL,
      new TraceCommand(logger, this.serviceContainer, new AllTracesStrategy())
    );

    this.commands.set(
      COMMANDS.TRACE_METHODS_ONLY,
      new TraceCommand(logger, this.serviceContainer, new MethodsOnlyStrategy())
    );

    this.commands.set(
      COMMANDS.TRACE_MEDIATR_ONLY,
      new TraceCommand(logger, this.serviceContainer, new MediatrOnlyStrategy())
    );
  }

  /**
   * Register commands with VS Code
   * @param context Extension context
   */
  registerWithVSCode(context: vscode.ExtensionContext): void {
    for (const [commandId, command] of this.commands) {
      const disposable = vscode.commands.registerCommand(commandId, () => command.execute());
      context.subscriptions.push(disposable);
    }
  }

  /**
   * Get a command by ID
   * @param commandId Command identifier
   */
  getCommand(commandId: string): ICommand | undefined {
    return this.commands.get(commandId);
  }

  /**
   * Execute a command by ID
   * @param commandId Command identifier
   * @param context Optional context
   */
  async executeCommand(commandId: string, context?: any): Promise<void> {
    const command = this.commands.get(commandId);
    if (!command) {
      throw new Error(`Command '${commandId}' not found`);
    }
    
    await command.execute(context);
  }
}
