import { PromptTemplate } from './types';

/**
 * Template for single-shot documentation generation
 */
export const singleShotTemplate: PromptTemplate = {
  name: 'single-shot',
  template: `{{baseInstructions}}

{{businessContext}}

{{codeTrace}}`,
  requiredComponents: ['baseInstructions', 'businessContext', 'codeTrace']
};

/**
 * Template for chunk analysis (information extraction)
 */
export const chunkAnalysisTemplate: PromptTemplate = {
  name: 'chunk-analysis',
  template: `{{chunkAnalysisInstructions}}

{{codeTrace}}`,
  requiredComponents: ['chunkAnalysisInstructions', 'codeTrace']
};

/**
 * Template for final document consolidation
 */
export const consolidationTemplate: PromptTemplate = {
  name: 'consolidation',
  template: `{{baseInstructions}}

{{businessContext}}

{{consolidationInstructions}}

{{chunkAnalyses}}`,
  requiredComponents: ['baseInstructions', 'businessContext', 'consolidationInstructions', 'chunkAnalyses']
};

/**
 * Registry of all available templates
 */
export const promptTemplates = {
  'single-shot': singleShotTemplate,
  'chunk-analysis': chunkAnalysisTemplate,
  'consolidation': consolidationTemplate
};

/**
 * Get a template by name
 */
export function getTemplate(templateName: string): PromptTemplate | undefined {
  return promptTemplates[templateName as keyof typeof promptTemplates];
}

