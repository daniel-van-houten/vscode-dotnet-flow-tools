import { ComponentRegistry } from '../types';
import { stripIndent } from 'common-tags';

/**
 * Chunking-specific components for processing large traces
 */
export const chunkingComponents: Partial<ComponentRegistry> = {
  /** Instructions for chunk analysis */
  chunkAnalysisInstructions: {
    content: ({ chunkIndex, totalChunks, className, methodName }) =>
      stripIndent`
        ## Chunk Processing Instructions

        You are processing chunk ${chunkIndex} of ${totalChunks} for the **${className}.${methodName}** process.

        ### Your Task
        - Analyze the code sections in this chunk  
        - Extract business logic and rules  
        - Focus on the specific functionality in this chunk  
        - Maintain consistency with the overall process flow  

        ### Key Points to Consider
        - The complete code Call Graph is included for each chunk to help you understand the given methods and how they fit into the whole. 

        ### Output Format
        Provide a focused analysis of this chunk's business logic that will be integrated with other chunks.
      `
  },

  /** Final consolidation instructions */
  consolidationInstructions: {
    content: ({ totalChunks, className, methodName }) =>
      stripIndent`
        ## Consolidation Instructions

        You are consolidating **${totalChunks}** chunk analyses into a final business document for **${className}.${methodName}**.

        ### Your Task
        - Merge all chunk analyses into a cohesive document  
        - Ensure logical flow and consistency  
        - Remove any redundancy between chunks  
        - Create a comprehensive business process guide  

        ### Final Document Structure
        Follow the standard documentation format (Overview, Process Flow, Business Rules, etc.).
      `
  },

  /** Previous document context wrapper */
  previousDocumentContext: {
    content: ({ previousDocument }) => {
      if (!previousDocument) {
        return '';
      }
      return stripIndent`
        **Current Document State:**
        \`\`\`
        ${previousDocument}
        \`\`\`
      `;
    }
  },

  /** Combined chunk analyses */
  chunkAnalyses: {
    content: ({ chunkAnalyses, chunkCount }) => {
      if (!chunkAnalyses) {
        return '';
      }
      return stripIndent`
        **Combined Analyses from ${chunkCount} Code Chunks:**

        ${chunkAnalyses}
      `;
    }
  }
};
