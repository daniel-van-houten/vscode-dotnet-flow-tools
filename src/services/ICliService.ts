/**
 * CLI execution parameters
 */
export interface CliExecutionParams {
  /**
   * Working directory for the CLI command
   */
  cwd?: string;
  
  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}

/**
 * CLI execution result
 */
export interface CliExecutionResult {
  /**
   * Standard output
   */
  stdout: string;
  
  /**
   * Standard error
   */
  stderr: string;
  
  /**
   * Exit code
   */
  exitCode: number;
}

/**
 * Service for executing CLI commands
 */
export interface ICliService {
  /**
   * Execute a CLI command
   * @param command Command to execute
   * @param args Command arguments
   * @param params Execution parameters
   */
  execute(command: string, args: string[], params?: CliExecutionParams): Promise<CliExecutionResult>;
}