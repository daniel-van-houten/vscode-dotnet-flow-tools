import * as vscode from 'vscode';
import { ICommand, CommandContext } from './ICommand';
import { ILogger } from './Logger';
import { ExtensionError, ValidationError } from './ErrorTypes';

/**
 * Abstract base class for commands with common functionality
 */
export abstract class BaseCommand implements ICommand {
  constructor(protected readonly logger: ILogger) {}

  /**
   * Execute the command with error handling and progress reporting
   */
  async execute(context?: any): Promise<void> {
    try {
      await this.executeInternal(context);
    } catch (error) {
      await this.handleError(error);
    }
  }

  /**
   * Internal execution method to be implemented by subclasses
   */
  protected abstract executeInternal(context?: any): Promise<void>;

  /**
   * Handle errors with appropriate user feedback
   */
  protected async handleError(error: unknown): Promise<void> {
    this.logger.error('Command execution failed', error instanceof Error ? error : new Error(String(error)));

    // Friendly guidance for GitHub Copilot "model_not_supported"
    const errMsg = error instanceof Error ? error.message : String(error);
    if (typeof errMsg === 'string' && errMsg.includes('model_not_supported')) {
      const action = await vscode.window.showErrorMessage(
        'Model not supported: The requested model isn’t enabled. Enable it in GitHub Copilot, then try again.',
        'Open Copilot settings'
      );
      if (action === 'Open Copilot settings') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/copilot/features'));
      }
      return;
    }

    let message: string;
    let showSettings = false;

    if (error instanceof ExtensionError) {
      message = error.message;
      
      // Show settings for configuration errors
      if (error.code === 'CONFIG_ERROR') {
        showSettings = true;
      }
    } else if (error instanceof vscode.CancellationError) {
      // User cancelled - no need to show error
      return;
    } else {
      message = 'An unexpected error occurred during command execution.';
    }

    const selection = showSettings 
      ? await vscode.window.showErrorMessage(message, 'Open Settings')
      : await vscode.window.showErrorMessage(message);
    
    if (selection === 'Open Settings') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'dotnetFlow');
    }
  }

  /**
   * Execute command with progress reporting
   */
  protected async withProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>
  ): Promise<T> {
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: true
    }, task);
  }

  /**
   * Validate that an active editor exists
   */
  protected validateActiveEditor(): vscode.TextEditor {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new ValidationError('No active text editor found');
    }
    return editor;
  }

  /**
   * Create command context from current VS Code state
   */
  protected createCommandContext(
    extensionContext: vscode.ExtensionContext,
    cancellationToken?: vscode.CancellationToken,
    progressCallback?: (message: string, increment?: number) => void
  ): CommandContext {
    return {
      extensionContext,
      activeEditor: vscode.window.activeTextEditor,
      cancellationToken,
      progressCallback
    };
  }
}
