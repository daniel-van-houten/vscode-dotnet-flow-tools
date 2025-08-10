import * as vscode from "vscode";
import { ITokenManager, TokenUsage, ModelTokenLimits } from "./ITokenManager";

export class BuiltInTokenManager implements ITokenManager {
  readonly providerId = "built-in";

  /**
   * Static fallback token limits for known VS Code Language Model API providers.
   * We prefer live limits from the current VS Code model (when available),
   * and only use these values when the model doesn't expose them.
   * Keep this list lean and only include models we actively target.
   */
  private static readonly MODEL_LIMITS: ModelTokenLimits[] = [
    // GitHub Copilot models (estimated limits based on known models)
    {
      modelId: "gpt-5",
      maxInput: 100000,
      maxOutput: 16384,
      contextWindow: 128000,
      estimationRatio: 4,
    },
    {
      modelId: "gpt-4o",
      maxInput: 110000,
      maxOutput: 16384,
      contextWindow: 128000,
      estimationRatio: 4,
    },
    {
      modelId: "gpt-4.1",
      maxInput: 110000,
      maxOutput: 16384,
      contextWindow: 128000,
      estimationRatio: 4,
    },
    {
      modelId: "claude-3-5-sonnet",
      maxInput: 110000,
      maxOutput: 8192,
      contextWindow: 200000,
      estimationRatio: 3.5,
    },
  ];

  private static readonly DEFAULT_LIMITS: ModelTokenLimits = {
    modelId: "default",
    maxInput: 32000,
    maxOutput: 4096,
    contextWindow: 32000,
    estimationRatio: 4,
  };

  constructor(private currentModel?: vscode.LanguageModelChat) {}

  getMaxInputTokens(modelId?: string): number {
    // Prefer live limits from the current VS Code model when available
    if (this.currentModel?.maxInputTokens) {
      return this.currentModel.maxInputTokens;
    }

    // Look up by model ID
    if (modelId) {
      const limits = this.findModelLimits(modelId);
      return limits.maxInput;
    }

    return BuiltInTokenManager.DEFAULT_LIMITS.maxInput;
  }

  getMaxOutputTokens(modelId?: string): number {
    // VS Code Language Model API does not expose output token limits.
    // We use known static limits when available, otherwise fall back to DEFAULT limits.
    if (modelId) {
      const limits = this.findModelLimits(modelId);
      return limits.maxOutput;
    }

    return BuiltInTokenManager.DEFAULT_LIMITS.maxOutput;
  }

  async countTokens(content: string, modelId?: string): Promise<number> {
    // Try to use VS Code's built-in token counting if available
    if (this.currentModel?.countTokens) {
      try {
        return await this.currentModel.countTokens(content);
      } catch (error) {
        console.warn(
          "VS Code token counting failed, falling back to estimation:",
          error,
        );
      }
    }

    // Fall back to simple estimation:
    // use model-specific estimationRatio (chars/token) when known, otherwise DEFAULT limits.
    return this.estimateTokens(content, modelId);
  }

  estimateTokens(content: string, modelId?: string): number {
    const limits = modelId
      ? this.findModelLimits(modelId)
      : BuiltInTokenManager.DEFAULT_LIMITS;
    return Math.ceil(content.length / limits.estimationRatio);
  }

  async fitsWithinLimits(
    content: string,
    modelId?: string,
    reserveTokens: number = 1000,
  ): Promise<boolean> {
    const tokenCount = await this.countTokens(content, modelId);
    const maxTokens = this.getMaxInputTokens(modelId);
    return tokenCount + reserveTokens <= maxTokens;
  }

  async getTokenUsage(content: string, modelId?: string): Promise<TokenUsage> {
    const tokens = await this.countTokens(content, modelId);
    const maxTokens = this.getMaxInputTokens(modelId);
    const remainingTokens = Math.max(0, maxTokens - tokens);
    const usagePercentage = Math.round((tokens / maxTokens) * 100);

    let recommendation: TokenUsage["recommendation"] = "ok";
    if (usagePercentage >= 95) {
      recommendation = "reduce_content";
    } else if (usagePercentage >= 85) {
      recommendation = "chunk_required";
    } else if (usagePercentage >= 70) {
      recommendation = "warning";
    }

    return {
      tokens,
      maxTokens,
      usagePercentage,
      remainingTokens,
      fitsWithinLimits: tokens <= maxTokens,
      recommendation,
    };
  }

  /**
   * Update the current model reference for accurate token counting
   */
  setCurrentModel(model: vscode.LanguageModelChat): void {
    this.currentModel = model;
  }

  private findModelLimits(modelId: string): ModelTokenLimits {
    // Try exact match first
    let limits = BuiltInTokenManager.MODEL_LIMITS.find(
      (limit) => limit.modelId === modelId,
    );

    if (!limits) {
      // Try partial matches for model families
      if (modelId.includes("gpt-4o")) {
        limits = BuiltInTokenManager.MODEL_LIMITS.find(
          (limit) => limit.modelId === "gpt-4o",
        );
      } else if (modelId.includes("gpt-4.1")) {
        limits = BuiltInTokenManager.MODEL_LIMITS.find(
          (limit) => limit.modelId === "gpt-4.1",
        );
      } else if (modelId.includes("claude-3-5-sonnet")) {
        limits = BuiltInTokenManager.MODEL_LIMITS.find(
          (limit) => limit.modelId === "claude-3-5-sonnet",
        );
      }
    }

    return limits || BuiltInTokenManager.DEFAULT_LIMITS;
  }
}
