import { ITokenManager, TokenUsage, ModelTokenLimits } from './ITokenManager';

export class BedrockTokenManager implements ITokenManager {
  readonly providerId = 'bedrock';

  // Bedrock model token limits based on AWS documentation
  private static readonly MODEL_LIMITS: ModelTokenLimits[] = [

    // Amazon Nova models
    { modelId: 'amazon.nova-lite-v1:0', maxInput: 300000, maxOutput: 5000, contextWindow: 300000, estimationRatio: 4 },
    { modelId: 'amazon.nova-micro-v1:0', maxInput: 128000, maxOutput: 5000, contextWindow: 128000, estimationRatio: 4 },
    { modelId: 'amazon.nova-premier-v1:0', maxInput: 300000, maxOutput: 5000, contextWindow: 300000, estimationRatio: 4 },
    { modelId: 'amazon.nova-pro-v1:0', maxInput: 300000, maxOutput: 5000, contextWindow: 300000, estimationRatio: 4 },

    // Anthropic Claude models
    { modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0', maxInput: 130000, maxOutput: 8000, contextWindow: 200000, estimationRatio: 3.5 },

    // Cohere models
    { modelId: 'cohere.command-r-plus-v1:0', maxInput: 128000, maxOutput: 4000, contextWindow: 128000, estimationRatio: 4 },
    { modelId: 'cohere.command-r-v1:0', maxInput: 128000, maxOutput: 4000, contextWindow: 128000, estimationRatio: 4 },

    // Meta Llama models
    { modelId: 'meta.llama3-1-405b-instruct-v1:0', maxInput: 128000, maxOutput: 2048, contextWindow: 128000, estimationRatio: 4 },
    { modelId: 'meta.llama3-1-70b-instruct-v1:0', maxInput: 128000, maxOutput: 2048, contextWindow: 128000, estimationRatio: 4 },
    { modelId: 'meta.llama3-1-8b-instruct-v1:0', maxInput: 128000, maxOutput: 2048, contextWindow: 128000, estimationRatio: 4 },

    // Mistral models
    { modelId: 'mistral.mistral-7b-instruct-v0:2', maxInput: 32000, maxOutput: 8192, contextWindow: 32000, estimationRatio: 4 },
    { modelId: 'mistral.mistral-large-2407-v1:0', maxInput: 128000, maxOutput: 8192, contextWindow: 128000, estimationRatio: 4 },
    { modelId: 'mistral.mixtral-8x7b-instruct-v0:1', maxInput: 32000, maxOutput: 8192, contextWindow: 32000, estimationRatio: 4 }
  ];

  private static readonly DEFAULT_LIMITS: ModelTokenLimits = {
    modelId: 'default',
    maxInput: 100000,
    maxOutput: 4096,
    contextWindow: 100000,
    estimationRatio: 4
  };

  getMaxInputTokens(modelId?: string): number {
    if (!modelId) {
      return BedrockTokenManager.DEFAULT_LIMITS.maxInput;
    }

    const limits = this.findModelLimits(modelId);
    return limits.maxInput;
  }

  getMaxOutputTokens(modelId?: string): number {
    if (!modelId) {
      return BedrockTokenManager.DEFAULT_LIMITS.maxOutput;
    }

    const limits = this.findModelLimits(modelId);
    return limits.maxOutput;
  }

  async countTokens(content: string, modelId?: string): Promise<number> {
    // Bedrock doesn't provide a direct token counting API
    // We'll use our estimation method which is tuned per model
    return this.estimateTokens(content, modelId);
  }

  estimateTokens(content: string, modelId?: string): number {
    const limits = modelId ? this.findModelLimits(modelId) : BedrockTokenManager.DEFAULT_LIMITS;
    return Math.ceil(content.length / limits.estimationRatio);
  }

  async fitsWithinLimits(content: string, modelId?: string, reserveTokens: number = 1000): Promise<boolean> {
    const tokenCount = await this.countTokens(content, modelId);
    const maxTokens = this.getMaxInputTokens(modelId);
    return (tokenCount + reserveTokens) <= maxTokens;
  }

  async getTokenUsage(content: string, modelId?: string): Promise<TokenUsage> {
    const tokens = await this.countTokens(content, modelId);
    const maxTokens = this.getMaxInputTokens(modelId);
    const remainingTokens = Math.max(0, maxTokens - tokens);
    const usagePercentage = Math.round((tokens / maxTokens) * 100);

    let recommendation: TokenUsage['recommendation'] = 'ok';
    if (usagePercentage >= 95) {
      recommendation = 'reduce_content';
    } else if (usagePercentage >= 85) {
      recommendation = 'chunk_required';
    } else if (usagePercentage >= 70) {
      recommendation = 'warning';
    }

    return {
      tokens,
      maxTokens,
      usagePercentage,
      remainingTokens,
      fitsWithinLimits: tokens <= maxTokens,
      recommendation
    };
  }

  /**
   * Get detailed model information including token limits
   */
  getModelInfo(modelId: string): ModelTokenLimits | null {
    return BedrockTokenManager.MODEL_LIMITS.find(limit => limit.modelId === modelId) || null;
  }

  /**
   * Get all supported models with their token limits
   */
  getSupportedModels(): ModelTokenLimits[] {
    return [...BedrockTokenManager.MODEL_LIMITS];
  }

  private findModelLimits(modelId: string): ModelTokenLimits {
    const limits = BedrockTokenManager.MODEL_LIMITS.find(limit => limit.modelId === modelId);
    
    if (!limits) {
      console.warn(`Token limits not found for Bedrock model: ${modelId}, using defaults`);
      return BedrockTokenManager.DEFAULT_LIMITS;
    }

    return limits;
  }
}