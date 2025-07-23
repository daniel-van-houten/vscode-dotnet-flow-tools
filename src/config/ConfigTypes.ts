/**
 * Extension configuration interface
 */
export interface DotnetFlowConfig {
  /**
   * Path to the CLI executable
   */
  cliBuild: string;
  
  /**
   * AI provider to use
   */
  provider: 'built-in' | 'bedrock';
  
  /**
   * AI model ID
   */
  modelId: string;
  
  /**
   * AWS profile for Bedrock provider
   */
  awsProfile: string;
  
  /**
   * AWS region for Bedrock provider
   */
  awsRegion: string;
  
  /**
   * Business domain context for documentation generation
   */
  businessContext: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: DotnetFlowConfig = {
  cliBuild: '${extensionPath}/cli/dotnet-flow',
  provider: 'built-in',
  modelId: '',
  awsProfile: 'default',
  awsRegion: 'us-east-1',
  businessContext: ''
};