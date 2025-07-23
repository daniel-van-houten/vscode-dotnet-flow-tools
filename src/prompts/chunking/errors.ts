export class TraceValidationError extends Error {
  constructor(message: string) {
    super(`Invalid trace structure: ${message}`);
    this.name = 'TraceValidationError';
  }
}

export class TokenLimitExceededError extends Error {
  constructor(tokenCount: number, maxTokens: number) {
    super(`Token limit exceeded: ${tokenCount} tokens (max: ${maxTokens})`);
    this.name = 'TokenLimitExceededError';
  }
}