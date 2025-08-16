import * as vscode from 'vscode';
import * as path from 'node:path';
import { ICliService } from './ICliService';
import { IConfigService } from './IConfigService';
import { ITraceService, TraceVerbosity } from './ITraceService';

/**
 * TraceService centralizes construction of CLI arguments and execution for trace generation.
 * Commands provide verbosity and any extra flags; this service returns raw stdout.
 */
export class TraceService implements ITraceService {
  async generateTrace(
    cliService: ICliService,
    configService: IConfigService,
    extensionPath: string,
    solutionUri: vscode.Uri,
    className: string,
    methodName: string,
    verbosity: TraceVerbosity,
    extraArgs: string[] = []
  ): Promise<string> {
    const cliPath = configService.getCliPath(extensionPath);

    // Uniform framework-dependent execution across all OS via the dotnet host
    const command = 'dotnet';
    const args = [
      cliPath,
      ...this.buildArgs(
        solutionUri.fsPath,
        className,
        methodName,
        verbosity,
        extraArgs
      )
    ];

    const result = await cliService.execute(command, args, {
      cwd: path.dirname(solutionUri.fsPath)
    });

    return result.stdout;
  }

  private buildArgs(
    solutionPath: string,
    className: string,
    methodName: string,
    verbosity: TraceVerbosity,
    extraArgs: string[]
  ): string[] {
    const baseArgs: string[] = [
      '-s', solutionPath,
      '-c', className,
      '-m', methodName,
      '-v', verbosity
    ];

    // Filter out any empty/undefined args defensively
    const extras = (extraArgs ?? []).filter(a => typeof a === 'string' && a.trim().length > 0);

    return [...baseArgs, ...extras];
  }
}
