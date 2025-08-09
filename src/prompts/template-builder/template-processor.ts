import { PromptBuildContext, PromptComponent } from './types';
import { getTemplate } from './templates';

// Direct component imports (no factory pattern)
import { BaseInstructionsComponent } from './components/base/BaseInstructionsComponent';
import { DocumentationStyleComponent } from './components/base/DocumentationStyleComponent';
import { BusinessContextComponent } from './components/business/BusinessContextComponent';
import { BusinessRuleFrameworkComponent } from './components/business/BusinessRuleFrameworkComponent';
import { CodeTraceComponent } from './components/formatting/CodeTraceComponent';
import { chunkingComponents } from './components/chunking';

/**
 * Error thrown when a component cannot be resolved
 */
export class ComponentResolutionError extends Error {
  constructor(
    message: string,
    public readonly context: {
      componentName?: string;
      missingComponent?: string;
      availableComponents?: string[];
      availableContext?: string[];
      missingParameters?: string[];
      templateName?: string;
    }
  ) {
    super(message);
    this.name = 'ComponentResolutionError';
  }
}

/**
 * Result type for template processing
 */
export type TemplateResult = {
  success: true;
  content: string;
} | {
  success: false;
  error: string;
  context: {
    missingComponent?: string;
    availableContext?: string[];
    templateName?: string;
    availableComponents?: string[];
    missingParameters?: string[];
  };
};

/**
 * Modern template builder with single-pass resolution and clear error handling
 */
export class PromptTemplateBuilder {
  private context: PromptBuildContext;
  private components: { [name: string]: PromptComponent };

  constructor(context: PromptBuildContext) {
    this.context = context;
    this.components = this.buildComponentRegistry();
  }

  /**
   * Build the component registry
   */
  private buildComponentRegistry(): { [name: string]: PromptComponent } {
    const registry: { [name: string]: PromptComponent } = {};
    
    // Base components
    registry.baseInstructions = BaseInstructionsComponent;
    registry.documentationStyle = DocumentationStyleComponent;

    // Business components  
    registry.businessContext = BusinessContextComponent;
    registry.businessRuleNarrativeFramework = BusinessRuleFrameworkComponent;

    // Formatting components
    registry.codeTrace = CodeTraceComponent;

    // Chunking components
    Object.entries(chunkingComponents).forEach(([name, component]) => {
      if (component) {
        registry[name] = component;
      }
    });
    
    return registry;
  }

  /**
   * Build a template with explicit success/failure result
   */
  build(templateName: string): TemplateResult {
    const template = getTemplate(templateName);
    if (!template) {
      return this.failure(`Template '${templateName}' not found`, { templateName });
    }

    try {
      const content = this.resolveTemplate(template.template);
      return { success: true, content };
    } catch (error) {
      if (error instanceof ComponentResolutionError) {
        return this.failure(error.message, { templateName, ...error.context });
      }
      return this.failure(`Template processing failed: ${error instanceof Error ? error.message : String(error)}`, { templateName });
    }
  }

  /**
   * Resolve template with single-pass processing
   */
  resolveTemplate(template: string): string {
    // Extract all placeholders first
    const placeholders = template.match(/\{\{(\w+)\}\}/g) || [];
    const componentNames = [...new Set(placeholders.map(p => p.replace(/\{\{|\}\}/g, '')))];

    // Resolve each component exactly once
    const resolutions = new Map<string, string>();
    
    for (const componentName of componentNames) {
      const content = this.resolveComponent(componentName);
      
      // Check if resolved content contains more placeholders
      if (content.includes('{{')) {
        console.warn(`Component '${componentName}' generated content with placeholders:`, content.substring(0, 200));
      }
      
      resolutions.set(componentName, content);
    }

    // Replace all placeholders in one pass
    let result = template;
    for (const [componentName, content] of resolutions) {
      result = result.replaceAll(`{{${componentName}}}`, content);
    }

    // Verify complete resolution (sanity check) - only check for unresolved template placeholders
    // Ignore Mermaid diagram syntax like {{Contact Supplier for Restock}} which contains spaces/special chars
    const unresolvedTemplatePlaceholders = result.match(/\{\{(\w+)\}\}/g) || [];
    if (unresolvedTemplatePlaceholders.length > 0) {
      console.error('Template still contains unresolved template placeholders:', unresolvedTemplatePlaceholders);
      console.error('Full result snippet:', result.substring(0, Math.min(500, result.length)));
      
      throw new Error(`Template still contains unresolved template placeholders: ${unresolvedTemplatePlaceholders.join(', ')}`);
    }

    return result.trim();
  }

  /**
   * Resolve a single component
   */
  private resolveComponent(componentName: string): string {
    const component = this.components[componentName];
    if (!component) {
      throw new ComponentResolutionError(
        `Component '${componentName}' not found`,
        {
          missingComponent: componentName,
          availableComponents: Object.keys(this.components)
        }
      );
    }

    if (typeof component.content === 'function') {
      try {
        return component.content(this.context);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new ComponentResolutionError(
          `Component '${componentName}' failed: ${errorMessage}`,
          {
            componentName,
            availableContext: Object.keys(this.context),
            missingParameters: this.detectMissingParameters(error instanceof Error ? error : new Error(String(error)), componentName)
          }
        );
      }
    }

    return component.content;
  }

  /**
   * Try to detect missing parameters from error messages
   */
  private detectMissingParameters(error: Error, _componentName: string): string[] {
    const errorMessage = error.message.toLowerCase();
    const contextKeys = Object.keys(this.context);
    const missing: string[] = [];
    
    // Common parameter patterns that might be missing
    const patterns = ['chunkindex', 'totalchunks', 'classname', 'methodname', 'businesscontext', 'codetrace'];
    
    for (const pattern of patterns) {
      if (errorMessage.includes(pattern) && !contextKeys.some(key => key.toLowerCase() === pattern)) {
        missing.push(pattern);
      }
    }
    
    return missing;
  }

  /**
   * Helper to create failure results
   */
  private failure(error: string, context: any): TemplateResult {
    return { success: false, error, context };
  }

  /**
   * Validate a template and its dependencies
   */
  static validateTemplate(templateName: string): { valid: boolean; missing?: string[] } {
    const template = getTemplate(templateName);
    if (!template) {
      return { valid: false, missing: [`Template '${templateName}' not found`] };
    }

    // Create a temporary builder to check component availability
    const tempBuilder = new PromptTemplateBuilder({} as PromptBuildContext);
    const missing: string[] = [];
    const componentNames = PromptTemplateBuilder.extractComponentNames(template.template);

    for (const componentName of componentNames) {
      if (!tempBuilder.components[componentName]) {
        missing.push(componentName);
      }
    }

    return {
      valid: missing.length === 0,
      missing: missing.length > 0 ? missing : undefined
    };
  }

  /**
   * Extract all component names from a template
   */
  static extractComponentNames(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g) || [];
    return matches.map(match => match.replace(/\{\{|\}\}/g, ''));
  }
}

/**
 * Legacy PromptTemplateProcessor for backward compatibility
 */
export class PromptTemplateProcessor {
  /**
   * Build a prompt from a template and context (legacy API)
   */
  buildPrompt(templateName: string, context: PromptBuildContext): string {
    const builder = new PromptTemplateBuilder(context);
    const result = builder.build(templateName);
    
    if (result.success) {
      return result.content;
    } else {
      // For backward compatibility, throw an error with detailed context
      const contextStr = Object.entries(result.context)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join('; ');
      throw new Error(`${result.error} (${contextStr})`);
    }
  }

  /**
   * Validate a template and its dependencies
   */
  validateTemplate(templateName: string): { valid: boolean; missing?: string[] } {
    return PromptTemplateBuilder.validateTemplate(templateName);
  }

  /**
   * Estimate token count for a template
   */
  estimateTokens(templateName: string, context: PromptBuildContext): number {
    const builder = new PromptTemplateBuilder(context);
    const result = builder.build(templateName);
    
    if (result.success) {
      // Rough estimation: 1 token per 4 characters (standard approximation)
      return Math.ceil(result.content.length / 4);
    }
    
    return 0;
  }

  /**
   * Process a template directly (legacy API for tests)
   */
  processTemplate(template: string, context: PromptBuildContext): string {
    const builder = new PromptTemplateBuilder(context);
    
    // For direct template strings, we bypass the template registry
    try {
      const directResult = builder.resolveTemplate(template);
      return directResult;
    } catch (error) {
      if (error instanceof ComponentResolutionError) {
        throw new Error(`${error.message} (${JSON.stringify(error.context)})`);
      }
      throw error;
    }
  }

  /**
   * Legacy methods for backward compatibility (no-ops)
   */
  preloadComponents(_context: PromptBuildContext): void {}
  clearCache(): void {}
  getCacheStats(): { size: number; hitRate?: number } {
    return { size: 0 };
  }
}

/**
 * Singleton instance for backward compatibility
 */
export const templateProcessor = new PromptTemplateProcessor();