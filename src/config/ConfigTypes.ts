/**
 * Extension configuration interface
 */
export interface DotnetFlowConfig {
  /**
   * Combined provider and model in the format "providerId|modelId"
   * Example: "bedrock|us.anthropic.claude-3-5-sonnet-20240620-v1:0"
   */
  model?: string;
  
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
  model: undefined,
  awsProfile: 'default',
  awsRegion: 'us-east-1',
  businessContext: ''
};
