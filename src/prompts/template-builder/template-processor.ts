import { PromptBuildContext, PromptTemplate, PromptComponent } from './types';
import { getTemplate } from './templates';

// Direct component imports (no factory pattern)
import { BaseInstructionsComponent } from './components/base/BaseInstructionsComponent';
import { DocumentationStyleComponent } from './components/base/DocumentationStyleComponent';
import { BusinessContextComponent } from './components/business/BusinessContextComponent';
import { BusinessRuleFrameworkComponent } from './components/business/BusinessRuleFrameworkComponent';
import { CodeTraceComponent } from './components/formatting/CodeTraceComponent';
import { chunkingComponents } from './components/chunking';

/**
 * Simplified template processor with all processing logic in one class
 */
export class PromptTemplateProcessor {
  private componentRegistry: { [name: string]: PromptComponent } = {};

  constructor() {
    this.initializeComponents();
  }

  /**
   * Register all components directly (no factory pattern)
   */
  private initializeComponents(): void {
    // Base components
    this.componentRegistry.baseInstructions = BaseInstructionsComponent;
    this.componentRegistry.documentationStyle = DocumentationStyleComponent;

    // Business components  
    this.componentRegistry.businessContext = BusinessContextComponent;
    this.componentRegistry.businessRuleNarrativeFramework = BusinessRuleFrameworkComponent;

    // Formatting components
    this.componentRegistry.codeTrace = CodeTraceComponent;

    // Chunking components
    Object.entries(chunkingComponents).forEach(([name, component]) => {
      if (component) {
        this.componentRegistry[name] = component;
      }
    });
  }

  /**
   * Build a prompt from a template and context
   */
  buildPrompt(templateName: string, context: PromptBuildContext): string {
    const template = getTemplate(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    return this.processTemplate(template, context);
  }


  /**
   * Process a template (backward compatible for tests)
   */
  private processTemplate(template: PromptTemplate | string, context: PromptBuildContext): string {
    const templateString = typeof template === 'string' ? template : template.template;
    return this.render(templateString, context);
  }

  /**
   * Validate a template and its dependencies
   */
  validateTemplate(templateName: string): { valid: boolean; missing?: string[] } {
    const template = getTemplate(templateName);
    if (!template) {
      return { valid: false, missing: [`Template '${templateName}' not found`] };
    }

    const missing: string[] = [];
    const componentNames = this.extractComponentNames(template.template);

    for (const componentName of componentNames) {
      if (!this.componentRegistry[componentName]) {
        missing.push(componentName);
      }
    }

    return {
      valid: missing.length === 0,
      missing: missing.length > 0 ? missing : undefined
    };
  }

  /**
   * Render a template string by replacing placeholders with component content
   */
  private render(template: string, context: PromptBuildContext): string {
    let processed = template;
    let maxIterations = 10; // Prevent infinite loops
    let iteration = 0;
    
    // Keep processing until no more placeholders are found or max iterations reached
    while (processed.includes('{{') && iteration < maxIterations) {
      processed = processed.replace(/\{\{(\w+)\}\}/g, (match, componentName) => {
        return this.getComponentContent(componentName, context);
      });
      iteration++;
    }

    if (iteration >= maxIterations) {
      console.warn('Template processing reached maximum iterations - possible circular references');
    }
    
    return processed.trim();
  }


  /**
   * Get component content with context (no caching)
   */
  private getComponentContent(componentName: string, context: PromptBuildContext): string {
    const component = this.componentRegistry[componentName];
    if (!component) {
      console.warn(`Component '${componentName}' not found in registry`);
      return `{{${componentName}}}`;
    }

    if (typeof component.content === 'function') {
      return component.content(context);
    }

    return component.content;
  }

  /**
   * Extract all component names from a template
   */
  private extractComponentNames(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g) || [];
    return matches.map(match => match.replace(/\{\{|\}\}/g, ''));
  }

  /**
   * Estimate token count for a template
   */
  estimateTokens(templateName: string, context: PromptBuildContext): number {
    const template = getTemplate(templateName);
    if (!template) {
      return 0;
    }

    const rendered = this.render(template.template, context);
    // Rough estimation: 1 token per 4 characters (standard approximation)
    return Math.ceil(rendered.length / 4);
  }

  /**
   * Legacy methods for backward compatibility (now no-ops since no caching)
   */
  preloadComponents(_context: PromptBuildContext): void {
    // No-op since we removed caching
  }

  clearCache(): void {
    // No-op since we removed caching
  }

  getCacheStats(): { size: number; hitRate?: number } {
    return { size: 0 };
  }
}

/**
 * Singleton instance for backward compatibility
 */
export const templateProcessor = new PromptTemplateProcessor();
