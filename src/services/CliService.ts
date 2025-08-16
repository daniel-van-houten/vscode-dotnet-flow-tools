import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ICliService, CliExecutionParams, CliExecutionResult } from './ICliService';
import { CliError } from '../core/ErrorTypes';

const run = promisify(execFile);

/**
 * Implementation of CLI service using Node.js child_process
 */
export class CliService implements ICliService {
  async execute(command: string, args: string[], params?: CliExecutionParams): Promise<CliExecutionResult> {
    try {
      const options = {
        cwd: params?.cwd,
        timeout: params?.timeout
      };

      const { stdout, stderr } = await run(command, args, options);
      
      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        if (command === 'dotnet') {
          throw new CliError(
            `.NET SDK not found. This extension requires .NET 8+ SDK to be installed and available in PATH.
            
Download from: https://dotnet.microsoft.com/download/dotnet

If .NET is installed, ensure 'dotnet' is in your system PATH.`,
            error.code
          );
        }

        throw new CliError(
          `CLI executable not found at: ${command}. The CLI binary may not be properly installed with the extension.`,
          error.code
        );
      }

      // Some environments surface framework-not-found via stderr
      if (error.stderr?.includes('Microsoft.NETCore.App') && error.stderr?.includes('was not found')) {
        throw new CliError(
          `Required .NET runtime not found. Please install .NET 8+ SDK or Runtime.
          
Download from: https://dotnet.microsoft.com/download/dotnet
          
Error details: ${error.stderr}`,
          error.code || -1
        );
      }
      
      const exitCode = error.code || -1;
      const stderr = error.stderr || error.message;
      
      throw new CliError(
        `CLI execution failed: ${stderr}`,
        exitCode,
        stderr
      );
    }
  }
}
