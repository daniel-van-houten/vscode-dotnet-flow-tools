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

    // Check for circular references before processing
    const circularCheck = this.checkCircularReferences(templateName);
    if (circularCheck.hasCircularRef) {
      console.warn(`Circular reference detected in template '${templateName}':`, circularCheck.circularPath);
      console.warn('Processing with fallback approach - some placeholders may be removed');
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
    const maxIterations = 10; // Prevent infinite loops
    let iteration = 0;
    const processingHistory: string[] = []; // Track processed components for circular reference detection
    
    // Keep processing until no more placeholders are found or max iterations reached
    while (processed.includes('{{') && iteration < maxIterations) {
      const beforeProcessing = processed;
      const replacedComponents: string[] = [];
      
      processed = processed.replace(/\{\{(\w+)\}\}/g, (match, componentName) => {
        replacedComponents.push(componentName);
        return this.getComponentContent(componentName, context);
      });
      
      // Detect if we're making progress
      if (beforeProcessing === processed) {
        console.warn('Template processing stalled - no progress made in iteration', iteration + 1);
        console.warn('Remaining placeholders:', processed.match(/\{\{(\w+)\}\}/g) || []);
        break;
      }
      
      // Track processing history for circular reference detection
      processingHistory.push(`Iteration ${iteration + 1}: ${replacedComponents.join(', ')}`);
      
      iteration++;
    }

    if (iteration >= maxIterations) {
      console.warn('Template processing reached maximum iterations - possible circular references');
      console.warn('Processing history:', processingHistory);
      console.warn('Final template still contains placeholders:', processed.match(/\{\{(\w+)\}\}/g) || []);
      
      // Try single-shot approach by removing remaining placeholders
      const remainingPlaceholders = processed.match(/\{\{(\w+)\}\}/g) || [];
      if (remainingPlaceholders.length > 0) {
        console.warn('Processing with single-shot approach - removing remaining placeholders');
        processed = processed.replace(/\{\{(\w+)\}\}/g, (match, componentName) => {
          console.warn(`Removing unresolved placeholder: ${componentName}`);
          return `<!-- ${componentName} placeholder removed due to circular reference -->`;
        });
      }
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
   * Detect potential circular references in template dependencies
   */
  private detectCircularReferences(componentName: string, visited: Set<string> = new Set()): string[] {
    if (visited.has(componentName)) {
      return [componentName]; // Found circular reference
    }

    const component = this.componentRegistry[componentName];
    if (!component) {
      return []; // Component not found
    }

    visited.add(componentName);
    
    let componentContent: string;
    if (typeof component.content === 'function') {
      // Can't statically analyze function-based components without proper context
      // Skip circular detection for these components
      return [];
    } else {
      try {
        componentContent = component.content;
      } catch (error) {
        // If we can't get the content (e.g., ContentLoader not initialized), skip detection
        console.warn(`Cannot analyze component '${componentName}' for circular references:`, error);
        return [];
      }
    }

    const dependencyNames = this.extractComponentNames(componentContent);
    
    for (const depName of dependencyNames) {
      const circularPath = this.detectCircularReferences(depName, new Set(visited));
      if (circularPath.length > 0) {
        return [componentName, ...circularPath];
      }
    }

    return [];
  }

  /**
   * Check for circular references in a template
   */
  checkCircularReferences(templateName: string): { hasCircularRef: boolean; circularPath?: string[] } {
    const template = getTemplate(templateName);
    if (!template) {
      return { hasCircularRef: false };
    }

    const componentNames = this.extractComponentNames(template.template);
    
    for (const componentName of componentNames) {
      const circularPath = this.detectCircularReferences(componentName);
      if (circularPath.length > 0) {
        return { 
          hasCircularRef: true, 
          circularPath: circularPath 
        };
      }
    }

    return { hasCircularRef: false };
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
   * Fallback processing for templates with circular references or processing failures
   */
  private processSingleShotFallback(template: PromptTemplate | string, context: PromptBuildContext): string {
    const templateString = typeof template === 'string' ? template : template.template;
    
    console.warn('Using single-shot fallback processing - attempting safe placeholder resolution');
    
    // First pass: resolve only safe components (non-function based components that don't contain placeholders)
    let processed = templateString.replace(/\{\{(\w+)\}\}/g, (match, componentName) => {
      const component = this.componentRegistry[componentName];
      if (!component) {
        console.warn(`Component '${componentName}' not found - removing placeholder`);
        return `<!-- ${componentName} not found -->`;
      }

      if (typeof component.content === 'function') {
        try {
          const content = component.content(context);
          // Check if the generated content has placeholders
          if (content.includes('{{')) {
            console.warn(`Component '${componentName}' generates nested placeholders - flattening content`);
            // Remove any nested placeholders to prevent circular references
            return content.replace(/\{\{(\w+)\}\}/g, '<!-- nested placeholder removed -->');
          }
          return content;
        } catch (error) {
          console.warn(`Error processing component '${componentName}':`, error);
          return `<!-- ${componentName} processing error -->`;
        }
      }

      // For static content, check for nested placeholders
      if (component.content.includes('{{')) {
        console.warn(`Static component '${componentName}' contains placeholders - flattening`);
        return component.content.replace(/\{\{(\w+)\}\}/g, '<!-- nested placeholder removed -->');
      }

      return component.content;
    });

    return processed.trim();
  }

  /**
   * Build a prompt with enhanced error handling and fallback processing
   */
  buildPromptSafe(templateName: string, context: PromptBuildContext): { content: string; hadFallback: boolean; errors?: string[] } {
    const template = getTemplate(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const errors: string[] = [];
    let hadFallback = false;

    // Check for circular references before processing
    const circularCheck = this.checkCircularReferences(templateName);
    if (circularCheck.hasCircularRef) {
      errors.push(`Circular reference detected: ${circularCheck.circularPath?.join(' -> ')}`);
      console.warn(`Circular reference detected in template '${templateName}':`, circularCheck.circularPath);
      
      // Use fallback processing
      const content = this.processSingleShotFallback(template, context);
      return { content, hadFallback: true, errors };
    }

    try {
      // Try normal processing
      const content = this.processTemplate(template, context);
      
      // Check if normal processing left unresolved placeholders
      const remainingPlaceholders = content.match(/\{\{(\w+)\}\}/g);
      if (remainingPlaceholders) {
        errors.push(`Unresolved placeholders after processing: ${remainingPlaceholders.join(', ')}`);
        hadFallback = true;
      }
      
      return { content, hadFallback, errors: errors.length > 0 ? errors : undefined };
    } catch (error) {
      errors.push(`Template processing failed: ${error}`);
      console.warn('Template processing failed, using fallback:', error);
      
      // Use fallback processing
      const content = this.processSingleShotFallback(template, context);
      return { content, hadFallback: true, errors };
    }
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
