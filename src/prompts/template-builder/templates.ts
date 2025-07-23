import { PromptTemplate } from './types';

/**
 * Template for single-shot documentation generation
 */
export const singleShotTemplate: PromptTemplate = {
  name: 'single-shot',
  template: `{{baseInstructions}}

{{businessContext}}

{{singleShotNote}}

{{codeTrace}}`,
  requiredComponents: ['baseInstructions', 'businessContext', 'singleShotNote', 'codeTrace']
};

/**
 * Template for the first chunk in multi-chunk processing
 */
export const firstChunkTemplate: PromptTemplate = {
  name: 'first-chunk',
  template: `{{baseInstructions}}

{{businessContext}}

## Processing Instructions for Chunk {{chunkPosition}}

This is the FIRST chunk of a larger code trace. Create the beginning of a business process document following the structure requirements above.

{{firstChunkInstructions}}

{{codeTrace}}`,
  requiredComponents: ['baseInstructions', 'businessContext', 'chunkPosition', 'firstChunkInstructions', 'codeTrace']
};

/**
 * Template for middle chunks in multi-chunk processing
 */
export const middleChunkTemplate: PromptTemplate = {
  name: 'middle-chunk',
  template: `{{baseInstructions}}

{{businessContext}}

## Processing Instructions for Chunk {{chunkPosition}}

This is chunk {{chunkPosition}} in a larger code trace. Continue building the business process document.

{{previousDocumentContext}}

{{middleChunkInstructions}}

{{codeTrace}}`,
  requiredComponents: ['baseInstructions', 'businessContext', 'chunkPosition', 'previousDocumentContext', 'middleChunkInstructions', 'codeTrace']
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
  'first-chunk': firstChunkTemplate,
  'middle-chunk': middleChunkTemplate,
  'chunk-analysis': chunkAnalysisTemplate,
  'consolidation': consolidationTemplate
};

/**
 * Get a template by name
 */
export function getTemplate(templateName: string): PromptTemplate | undefined {
  return promptTemplates[templateName as keyof typeof promptTemplates];
}

