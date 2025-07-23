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
        throw new CliError(
          `CLI executable not found at: ${command}. Please check the 'dotnetFlow.cliBuild' setting.`,
          error.code
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