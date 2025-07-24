/**
 * Base error class for extension-specific errors
 */
export abstract class ExtensionError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Error thrown when CLI operations fail
 */
export class CliError extends ExtensionError {
  constructor(message: string, public readonly exitCode?: number, public readonly stderr?: string) {
    super(message, 'CLI_ERROR');
  }
}

/**
 * Error thrown when configuration is invalid or missing
 */
export class ConfigurationError extends ExtensionError {
  constructor(message: string, public readonly configKey?: string) {
    super(message, 'CONFIG_ERROR');
  }
}

/**
 * Error thrown when required resources are not found
 */
export class ResourceNotFoundError extends ExtensionError {
  constructor(message: string, public readonly resourceType?: string) {
    super(message, 'RESOURCE_NOT_FOUND');
  }
}

/**
 * Base error class for AI provider operations
 */
export abstract class ProviderError extends ExtensionError {
  constructor(
    message: string, 
    public readonly providerId: string,
    public readonly errorType?: string,
    public readonly originalError?: Error
  ) {
    super(message, 'PROVIDER_ERROR');
  }
}

/**
 * Error thrown by Bedrock provider operations
 */
export class BedrockProviderError extends ProviderError {
  constructor(message: string, errorType?: string, originalError?: Error) {
    super(message, 'bedrock', errorType, originalError);
  }

  static tokenExpired(): BedrockProviderError {
    return new BedrockProviderError(
      'Your Bedrock API Token has expired. Please refresh your AWS credentials.',
      'TOKEN_EXPIRED'
    );
  }

  static accessDenied(): BedrockProviderError {
    return new BedrockProviderError(
      'Access denied to Bedrock service. Please check your AWS credentials and IAM permissions for Amazon Bedrock.',
      'ACCESS_DENIED'
    );
  }

  static modelNotFound(modelId: string): BedrockProviderError {
    return new BedrockProviderError(
      `Model '${modelId}' not found or not available in your AWS region. Please verify the model ID and region configuration.`,
      'MODEL_NOT_FOUND'
    );
  }

  static throttled(): BedrockProviderError {
    return new BedrockProviderError(
      'Request throttled by AWS Bedrock. Please wait a moment and try again.',
      'THROTTLED'
    );
  }

  static invalidRequest(details: string): BedrockProviderError {
    return new BedrockProviderError(
      `Invalid request to Bedrock: ${details}`,
      'INVALID_REQUEST'
    );
  }

  static serviceUnavailable(): BedrockProviderError {
    return new BedrockProviderError(
      'AWS Bedrock service is temporarily unavailable. Please try again later.',
      'SERVICE_UNAVAILABLE'
    );
  }

  static modelNotSelected(): BedrockProviderError {
    return new BedrockProviderError(
      'No AI model selected. Please use the "Select AI Model" command to choose a Bedrock model before generating documentation.',
      'MODEL_NOT_SELECTED'
    );
  }

  static credentialsNotConfigured(): BedrockProviderError {
    return new BedrockProviderError(
      'AWS credentials not configured. Please configure your AWS credentials or select a different AI provider. You can use the "Select AI Model" command to choose from available options.',
      'CREDENTIALS_NOT_CONFIGURED'
    );
  }
}

/**
 * Error thrown by Built-in provider operations
 */
export class BuiltInProviderError extends ProviderError {
  constructor(message: string, errorType?: string, originalError?: Error) {
    super(message, 'built-in', errorType, originalError);
  }

  static consentRequired(): BuiltInProviderError {
    return new BuiltInProviderError(
      'Please give consent to use AI features in VS Code. You can enable this in VS Code settings under AI features.',
      'CONSENT_REQUIRED'
    );
  }

  static contentBlocked(): BuiltInProviderError {
    return new BuiltInProviderError(
      'Request was blocked by content policy. Please try with different content.',
      'CONTENT_BLOCKED'
    );
  }

  static rateLimited(): BuiltInProviderError {
    return new BuiltInProviderError(
      'Too many requests to VS Code language models. Please wait a moment and try again.',
      'RATE_LIMITED'
    );
  }

  static modelUnavailable(modelId?: string): BuiltInProviderError {
    const message = modelId 
      ? `Model '${modelId}' is not available. Please ensure GitHub Copilot is installed and active.`
      : 'No language models are available. Please ensure GitHub Copilot is installed and active.';
    
    return new BuiltInProviderError(message, 'MODEL_UNAVAILABLE');
  }
}

/**
 * Error thrown when user input is invalid
 */
export class ValidationError extends ExtensionError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR');
  }
}