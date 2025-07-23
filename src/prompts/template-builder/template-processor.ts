import { PromptBuildContext, PromptTemplate } from './types';
import { getComponentContent } from './components';
import { getTemplate } from './templates';

/**
 * Processes templates and replaces placeholders with component content
 */
export class PromptTemplateProcessor {
  /**
   * Build a prompt from a template and context
   */
  buildPrompt(templateName: string, context: PromptBuildContext): string {
    const template = getTemplate(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    return this.processTemplate(template.template, context);
  }

  /**
   * Process a template string, replacing placeholders with component content
   */
  private processTemplate(template: string, context: PromptBuildContext): string {
    let processed = template;
    let maxIterations = 10; // Prevent infinite loops
    let iteration = 0;
    
    // Keep processing until no more placeholders are found or max iterations reached
    while (processed.includes('{{') && iteration < maxIterations) {
      processed = processed.replace(/\{\{(\w+)\}\}/g, (match, componentName) => {
        const content = getComponentContent(componentName, context);
        return content;
      });
      iteration++;
    }
    
    return processed;
  }


  /**
   * Extract all component names from a template
   */
  private extractComponentNames(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g) || [];
    return matches.map(match => match.replace(/\{\{|\}\}/g, ''));
  }

  /**
   * Validate that all required components exist for a template
   */
  validateTemplate(templateName: string): { valid: boolean; missing?: string[] } {
    const template = getTemplate(templateName);
    if (!template) {
      return { valid: false, missing: [`Template '${templateName}' not found`] };
    }

    const missing: string[] = [];
    const componentNames = this.extractComponentNames(template.template);

    // Check if all components in the template exist
    for (const componentName of componentNames) {
      const content = getComponentContent(componentName, {});
      if (content === `{{${componentName}}}`) {
        missing.push(componentName);
      }
    }

    return {
      valid: missing.length === 0,
      missing: missing.length > 0 ? missing : undefined
    };
  }
}

/**
 * Singleton instance for convenience
 */
export const templateProcessor = new PromptTemplateProcessor();