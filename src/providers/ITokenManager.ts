/**
 * Token management abstraction for different AI providers
 * Each provider has different token limits, counting methods, and pricing models
 */
export interface ITokenManager {
  /**
   * Provider identifier
   */
  readonly providerId: string;

  /**
   * Get the maximum input tokens for the current model
   * @param modelId Optional specific model ID
   * @returns Maximum input tokens supported
   */
  getMaxInputTokens(modelId?: string): number;

  /**
   * Get the maximum output tokens for the current model
   * @param modelId Optional specific model ID
   * @returns Maximum output tokens supported
   */
  getMaxOutputTokens(modelId?: string): number;

  /**
   * Count tokens in the given content
   * @param content Text content to count tokens for
   * @param modelId Optional specific model ID for provider-specific counting
   * @returns Promise resolving to token count
   */
  countTokens(content: string, modelId?: string): Promise<number>;

  /**
   * Estimate tokens without async operations (fallback method)
   * @param content Text content to estimate tokens for
   * @param modelId Optional specific model ID
   * @returns Estimated token count
   */
  estimateTokens(content: string, modelId?: string): number;

  /**
   * Check if content fits within token limits
   * @param content Text content to check
   * @param modelId Optional specific model ID
   * @param reserveTokens Tokens to reserve for other content (default: 1000)
   * @returns True if content fits within limits
   */
  fitsWithinLimits(content: string, modelId?: string, reserveTokens?: number): Promise<boolean>;

  /**
   * Get token usage statistics for the content
   * @param content Text content to analyze
   * @param modelId Optional specific model ID
   * @returns Token usage breakdown
   */
  getTokenUsage(content: string, modelId?: string): Promise<TokenUsage>;
}

export interface TokenUsage {
  /**
   * Actual token count
   */
  tokens: number;

  /**
   * Maximum tokens allowed for this model
   */
  maxTokens: number;

  /**
   * Percentage of max tokens used (0-100)
   */
  usagePercentage: number;

  /**
   * Tokens remaining
   */
  remainingTokens: number;

  /**
   * Whether this content fits within limits
   */
  fitsWithinLimits: boolean;

  /**
   * Recommended action based on usage
   */
  recommendation: 'ok' | 'warning' | 'chunk_required' | 'reduce_content';
}

export interface ModelTokenLimits {
  /**
   * Model identifier
   */
  modelId: string;

  /**
   * Maximum input tokens
   */
  maxInput: number;

  /**
   * Maximum output tokens
   */
  maxOutput: number;

  /**
   * Total context window
   */
  contextWindow: number;

  /**
   * Token estimation ratio (characters per token)
   */
  estimationRatio: number;
}