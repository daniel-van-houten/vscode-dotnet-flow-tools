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
 * Error thrown when AI provider operations fail
 */
export class ProviderError extends ExtensionError {
  constructor(message: string, public readonly providerId?: string) {
    super(message, 'PROVIDER_ERROR');
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