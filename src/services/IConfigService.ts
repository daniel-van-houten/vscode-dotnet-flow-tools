import * as vscode from 'vscode';
import { DotnetFlowConfig } from '../config/ConfigTypes';

/**
 * Service for managing extension configuration
 */
export interface IConfigService {
  /**
   * Get the full configuration object
   */
  getConfig(): DotnetFlowConfig;
  
  /**
   * Get a specific configuration value
   * @param key Configuration key
   */
  get<K extends keyof DotnetFlowConfig>(key: K): DotnetFlowConfig[K];
  
  /**
   * Update a configuration value
   * @param key Configuration key
   * @param value New value
   * @param target Configuration target (global, workspace, etc.)
   */
  update<K extends keyof DotnetFlowConfig>(
    key: K, 
    value: DotnetFlowConfig[K], 
    target?: vscode.ConfigurationTarget
  ): Promise<void>;
  
  /**
   * Get the platform-aware CLI path
   * @param extensionPath Extension path
   */
  getCliPath(extensionPath: string): string;
}
