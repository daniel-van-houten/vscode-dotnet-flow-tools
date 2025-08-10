/**
 * Simple dependency injection container
 */
export class ServiceContainer {
  private readonly services = new Map<string, any>();
  private readonly factories = new Map<string, () => any>();

  /**
   * Register a service instance
   */
  register<T>(key: string, instance: T): void {
    this.services.set(key, instance);
  }

  /**
   * Register a service factory
   */
  registerFactory<T>(key: string, factory: () => T): void {
    this.factories.set(key, factory);
  }

  /**
   * Get a service instance
   */
  get<T>(key: string): T {
    // First check for direct instances
    if (this.services.has(key)) {
      return this.services.get(key) as T;
    }

    // Then check for factories
    if (this.factories.has(key)) {
      const factory = this.factories.get(key)!;
      const instance = factory();
      // Cache the instance for future use
      this.services.set(key, instance);
      return instance as T;
    }

    throw new Error(`Service '${key}' not found in container`);
  }

  /**
   * Check if service is registered
   */
  has(key: string): boolean {
    return this.services.has(key) || this.factories.has(key);
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
  }
}

/**
 * Service keys for type safety
 */
export const ServiceKeys = {
  LOGGER: "logger",
  CONFIG_SERVICE: "configService",
  CLI_SERVICE: "cliService",
  FILE_SERVICE: "fileService",
  SYMBOL_SERVICE: "symbolService",
  PROVIDER_REGISTRY: "providerRegistry",
  EXTENSION_CONTEXT: "extensionContext",
  TRACE_SERVICE: "traceService",
} as const;

export type ServiceKey = (typeof ServiceKeys)[keyof typeof ServiceKeys];
