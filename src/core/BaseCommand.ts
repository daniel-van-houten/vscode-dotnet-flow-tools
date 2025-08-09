import * as vscode from 'vscode';
import { ICommand, CommandContext } from './ICommand';
import { ILogger } from './Logger';
import { ExtensionError, ValidationError, ProviderError, ResourceNotFoundError } from './ErrorTypes';

const UI = {
  buttons: {
    installCopilot: 'Install Copilot',
    selectProvider: 'Select Different Provider',
    openSettings: 'Open Settings',
    openCopilotSettings: 'Open Copilot settings',
    copyDetails: 'Copy Details'
  },
  messages: {
    unexpected: 'An unexpected error occurred during command execution.',
    copilotModelNotSupported:
      "Model not supported: The requested model isn't enabled. Enable it in GitHub Copilot, then try again."
  },
  links: {
    copilotMarketplace: 'https://marketplace.visualstudio.com/items?itemName=GitHub.copilot',
    copilotFeatures: 'https://github.com/settings/copilot/features'
  }
};

function normalize(error: unknown): { message: string; stack?: string; instance?: Error } {
  if (error instanceof Error) {
    return { message: error.message ?? String(error), stack: error.stack, instance: error };
  }
  const message = String(error);
  return { message, stack: message };
}

async function presentError(
  message: string,
  actions: Array<{ label: string; run: () => Thenable<unknown> | void }>
): Promise<void> {
  const selection = await vscode.window.showErrorMessage(message, ...actions.map(a => a.label));
  const chosen = actions.find(a => a.label === selection);
  if (chosen) {
    await chosen.run();
  }
}

function providerActions(
  errorType: ProviderError['errorType']
): Array<{ label: string; run: () => Thenable<unknown> | void }> {
  switch (errorType) {
    case 'MODEL_UNAVAILABLE':
    case 'NOT_INITIALIZED':
      return [
        {
          label: UI.buttons.installCopilot,
          run: () =>
            vscode.env.openExternal(vscode.Uri.parse(UI.links.copilotMarketplace))
        },
        {
          label: UI.buttons.selectProvider,
          run: () => vscode.commands.executeCommand('dotnet-flow-tools.selectModel')
        }
      ];
    case 'CONSENT_REQUIRED':
      return [
        {
          label: UI.buttons.openSettings,
          run: () =>
            vscode.commands.executeCommand('workbench.action.openSettings', 'github.copilot')
        },
        {
          label: UI.buttons.selectProvider,
          run: () => vscode.commands.executeCommand('dotnet-flow-tools.selectModel')
        }
      ];
    case 'CONTENT_BLOCKED':
    case 'RATE_LIMITED':
    case 'THROTTLED':
      return [
        {
          label: UI.buttons.selectProvider,
          run: () => vscode.commands.executeCommand('dotnet-flow-tools.selectModel')
        }
      ];
    default:
      return [];
  }
}

async function handleCopilotModelNotSupported(errMsg: string): Promise<boolean> {
  if (!errMsg.includes('model_not_supported')) return false;
  await presentError(UI.messages.copilotModelNotSupported, [
    {
      label: UI.buttons.openCopilotSettings,
      run: () => vscode.env.openExternal(vscode.Uri.parse(UI.links.copilotFeatures))
    }
  ]);
  return true;
}

async function handleExtensionConfigError(error: ExtensionError): Promise<boolean> {
  if (error.code !== 'CONFIG_ERROR') return false;
  const selection = await vscode.window.showWarningMessage(error.message, UI.buttons.openSettings);
  if (selection === UI.buttons.openSettings) {
    vscode.commands.executeCommand('workbench.action.openSettings', 'dotnetFlow');
  }
  return true;
}

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
    // 1) Cancellation: no log, no UI
    if (error instanceof vscode.CancellationError) return;

    // 2) Normalize + log once
    const { message, stack, instance } = normalize(error);
    this.logger.error('Command execution failed', instance ?? new Error(message));

    // 3) Copilot special-case hint
    if (await handleCopilotModelNotSupported(message)) return;

    // 4) Provider errors
    if (error instanceof ProviderError) {
      if (error.originalError) this.logger.error('Provider original error', error.originalError);
      await presentError(error.message, providerActions(error.errorType));
      return;
    }

    // 5) Expected validation/precondition warnings
    if (error instanceof ValidationError || error instanceof ResourceNotFoundError) {
      await vscode.window.showWarningMessage(message);
      return;
    }

    // 6) Extension errors (+ CONFIG_ERROR fast path)
    if (error instanceof ExtensionError) {
      if (await handleExtensionConfigError(error)) return;
      await vscode.window.showErrorMessage(message);
      return;
    }

    // 7) Fallback with “Copy details” for supportability
    await presentError(UI.messages.unexpected, [
      { label: UI.buttons.copyDetails, run: () => vscode.env.clipboard.writeText(stack ?? message) }
    ]);
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
