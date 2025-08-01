import * as vscode from 'vscode';
import * as path from 'node:path';
import { BaseCommand } from '../core/BaseCommand';
import { ILogger } from '../core/Logger';
import { ServiceContainer, ServiceKeys } from '../core/ServiceContainer';
import { ICliService } from '../services/ICliService';
import { IFileService } from '../services/IFileService';
import { ISymbolService } from '../services/ISymbolService';
import { IConfigService } from '../services/IConfigService';
import { ProviderRegistry } from '../providers/ProviderRegistry';
import { processDocumentationWithChunking, analyzeTrace } from '../prompts';
import { ResourceNotFoundError, ValidationError } from '../core/ErrorTypes';
import { FILE_PATTERNS } from '../config/ConfigConstants';
import { resetPromptSequence } from '../core/DebugLogger';

/**
 * Command to generate comprehensive business documentation from C# methods
 */
export class DocumentThisCommand extends BaseCommand {
  constructor(
    logger: ILogger,
    private readonly serviceContainer: ServiceContainer
  ) {
    super(logger);
  }

  protected async executeInternal(): Promise<void> {
    await this.withProgress('', async (progress, token) => {
      // Reset prompt sequence for new documentation session
      resetPromptSequence();
      
      const context = await this.setupExecutionContext(progress, token);
      
      const trace = await this.generateCodeTrace(
        context.cliService, 
        context.configService, 
        context.solutions[0], 
        context.symbolInfo.class.name, 
        context.symbolInfo.method.name
      );

      if (token.isCancellationRequested) { return; }

      const shouldContinue = await this.handleProcessingStrategy(trace, context.provider, progress);
      if (!shouldContinue) { return; }

      if (token.isCancellationRequested) { return; }

      const result = await this.processDocumentation(trace, context, token, progress);
      
      this.showCompletionMessage(result, context.provider);

      if (token.isCancellationRequested) { return; }

      await this.saveAndOpenDocumentation(
        context.fileService,
        result.content,
        context.symbolInfo.class.name,
        context.symbolInfo.method.name
      );
      
      progress.report({ increment: 100, message: "Documentation complete!" });
    });
  }

  private async setupExecutionContext(
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
  ) {
    const editor = this.validateActiveEditor();
    
    progress.report({ increment: 0, message: "Analyzing code structure..." });
    
    const symbolService = this.serviceContainer.get<ISymbolService>(ServiceKeys.SYMBOL_SERVICE);
    const fileService = this.serviceContainer.get<IFileService>(ServiceKeys.FILE_SERVICE);
    const cliService = this.serviceContainer.get<ICliService>(ServiceKeys.CLI_SERVICE);
    const configService = this.serviceContainer.get<IConfigService>(ServiceKeys.CONFIG_SERVICE);
    const providerRegistry = this.serviceContainer.get<ProviderRegistry>(ServiceKeys.PROVIDER_REGISTRY);

    const symbolInfo = await symbolService.findMethodAtPosition(editor.document, editor.selection.active);
    if (!symbolInfo) {
      throw new ValidationError('Put cursor inside a method within a class.');
    }

    const solutions = await fileService.findFiles(FILE_PATTERNS.SOLUTION, undefined, 1);
    if (solutions.length === 0) {
      throw new ResourceNotFoundError('Solution (.sln) not found', 'solution');
    }

    if (token.isCancellationRequested) { throw new vscode.CancellationError(); }

    progress.report({ increment: 40, message: "Initializing AI model..." });
    
    const provider = providerRegistry.getCurrentProvider();
    if (!provider || !provider.isInitialized()) {
      throw new ResourceNotFoundError(
        'No AI provider available. Please configure an AI provider in settings.',
        'ai-provider'
      );
    }
    
    if (!provider.currentModelId || provider.currentModelId.trim() === '') {
      throw new ValidationError('No model selected. Please select an AI model using the "Select AI Model" command before generating documentation.');
    }

    progress.report({ increment: 20, message: "Generating code trace..." });

    return {
      symbolService,
      fileService,
      cliService,
      configService,
      provider,
      symbolInfo,
      solutions
    };
  }

  private async handleProcessingStrategy(
    trace: string,
    provider: any,
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<boolean> {
    progress.report({ increment: 50, message: "Analyzing trace size..." });

    const analysis = await analyzeTrace(trace, provider);
    
    if (analysis.approach === 'chunked') {
      const userChoice = await vscode.window.showInformationMessage(
        `📊 Processing Strategy\n\n${analysis.recommendation}\n\nThis will provide better quality results for large code traces.\n\nWould you like to continue?`,
        { modal: true },
        'Continue'
      );
      
      if (userChoice !== 'Continue') {
        return false;
      }
      
      progress.report({ increment: 60 });
    } else {
      progress.report({ increment: 60, message: "Generating documentation..." });
    }

    return true;
  }

  private async processDocumentation(
    trace: string,
    context: any,
    token: vscode.CancellationToken,
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ) {
    const businessContext = context.configService.get('businessContext');
    return await processDocumentationWithChunking(
      trace,
      context.provider,
      { className: context.symbolInfo.class.name, methodName: context.symbolInfo.method.name },
      businessContext,
      token,
      (message: string, increment?: number) => {
        progress.report({ message, increment });
      }
    );
  }

  private showCompletionMessage(result: any, provider: any): void {
    const approachText = result.approach === 'single-shot' 
      ? 'single-shot processing'
      : `${result.chunkCount} chunks`;
    vscode.window.setStatusBarMessage(
      `Documentation generated using ${provider.id} provider with ${approachText}`, 
      5000
    );
  }

  private async generateCodeTrace(
    cliService: ICliService,
    configService: IConfigService,
    solutionUri: vscode.Uri,
    className: string,
    methodName: string
  ): Promise<string> {
    const extensionContext = this.serviceContainer.get<vscode.ExtensionContext>(ServiceKeys.EXTENSION_CONTEXT);
    const cliPath = configService.getCliPath(extensionContext.extensionPath);

    const args = [
      `-s`, solutionUri.fsPath,
      `-c`, className,
      `-m`, methodName,
      `-v`, 'graph,code',
      `--methods-only`
    ];

    const result = await cliService.execute(cliPath, args, {
      cwd: path.dirname(solutionUri.fsPath)
    });

    return result.stdout;
  }

  private async saveAndOpenDocumentation(
    fileService: IFileService,
    content: string,
    className: string,
    methodName: string
  ): Promise<void> {
    const fileName = FILE_PATTERNS.DOCUMENTATION
      .replace('{className}', className)
      .replace('{methodName}', methodName);
    
    const documentUri = fileService.createWorkspaceUri(fileName);
    
    await fileService.writeFile(documentUri, content);
    const document = await fileService.openTextDocument(documentUri);
    await vscode.window.showTextDocument(document);
    
    // Show markdown preview
    vscode.commands.executeCommand('markdown.showPreview', document.uri);
  }
}
