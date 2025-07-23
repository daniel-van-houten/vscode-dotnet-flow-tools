import * as vscode from 'vscode';

/**
 * Base interface for all commands in the extension
 */
export interface ICommand {
  /**
   * Execute the command
   * @param context Additional context for command execution
   */
  execute(context?: any): Promise<void>;
}

/**
 * Context passed to commands during execution
 */
export interface CommandContext {
  /**
   * VS Code extension context
   */
  readonly extensionContext: vscode.ExtensionContext;
  
  /**
   * Active text editor (if any)
   */
  readonly activeEditor?: vscode.TextEditor;
  
  /**
   * Cancellation token for long-running operations
   */
  readonly cancellationToken?: vscode.CancellationToken;
  
  /**
   * Progress callback for reporting progress
   */
  readonly progressCallback?: (message: string, increment?: number) => void;
}