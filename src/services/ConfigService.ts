import * as vscode from 'vscode';
import { IConfigService } from './IConfigService';
import { DotnetFlowConfig, DEFAULT_CONFIG } from '../config/ConfigTypes';
import { CONFIG_SECTION } from '../config/ConfigConstants';
import { getCliPath } from '../utils/PlatformUtils';

/**
 * Implementation of configuration service
 */
export class ConfigService implements IConfigService {

  getConfig(): DotnetFlowConfig {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    
    return {
      model: config.get('model', DEFAULT_CONFIG.model),
      awsProfile: config.get('awsProfile', DEFAULT_CONFIG.awsProfile),
      awsRegion: config.get('awsRegion', DEFAULT_CONFIG.awsRegion),
      businessContext: config.get('businessContext', DEFAULT_CONFIG.businessContext)
    };
  }

  get<K extends keyof DotnetFlowConfig>(key: K): DotnetFlowConfig[K] {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get(key, DEFAULT_CONFIG[key]);
  }

  async update<K extends keyof DotnetFlowConfig>(
    key: K,
    value: DotnetFlowConfig[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(key, value, target);
  }

  getCliPath(extensionPath: string): string {
    return getCliPath(extensionPath);
  }
}
