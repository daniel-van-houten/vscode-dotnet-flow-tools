import * as vscode from 'vscode';
import { ICliService } from './ICliService';
import { IConfigService } from './IConfigService';

/**
 * Supported verbosity levels for trace generation.
 * - 'graph' produces only the call graph (suitable for quick visualization)
 * - 'graph,code' produces the call graph and referenced code blocks (for documentation)
 */
export type TraceVerbosity = 'graph' | 'graph,code';

/**
 * Service responsible for generating code traces by invoking the bundled CLI.
 *
 * Responsibility:
 * - Assemble CLI arguments in a single place to avoid duplication across commands.
 * - Execute the CLI via ICliService and return stdout as-is (commands decide on any post-processing).
 */
export interface ITraceService {
  /**
   * Generate a code trace for a given class and method in a solution.
   *
   * @param cliService CLI execution service
   * @param configService Configuration service (used to resolve CLI path)
   * @param extensionPath VS Code extension absolute path (used to resolve CLI binary location)
   * @param solutionUri URI of the .sln file to analyze
   * @param className Name of the containing class
   * @param methodName Name of the target method
   * @param verbosity Trace verbosity ('graph' | 'graph,code')
   * @param extraArgs Additional CLI flags (e.g., ['--methods-only', '--handlers-only'])
   * @returns Raw stdout string produced by the CLI
   */
  generateTrace(
    cliService: ICliService,
    configService: IConfigService,
    extensionPath: string,
    solutionUri: vscode.Uri,
    className: string,
    methodName: string,
    verbosity: TraceVerbosity,
    extraArgs?: string[]
  ): Promise<string>;
}
