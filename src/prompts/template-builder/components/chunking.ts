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

  /** Chunk position indicator */
  chunkPosition: {
    content: ({ chunkIndex, totalChunks }) => `${chunkIndex} of ${totalChunks}`
  },

  /** First chunk specific instructions */
  firstChunkInstructions: {
    content: ({ className, methodName }) => stripIndent`
      **Important Guidelines:**
      - Start with the document title: "${className}.${methodName} Process"
      - Create the Overview section based on what you can determine from this first chunk
      - Begin the Process Flow Overview with a Mermaid diagram if you can identify major phases and high-level conditional logic
      - Start documenting the Detailed Phases you can identify
      - Focus on extracting business rules and processes from this chunk
      - This is NOT the complete code - more chunks will follow to extend this document
    `
  },

  /** Middle chunk instructions */
  middleChunkInstructions: {
    content: stripIndent`
      **Instructions:**
      - Continue building upon the existing document structure
      - Add new phases, business rules, and processes found in this chunk
      - Update the Process Flow Overview if new major phases are discovered
      - Maintain consistency with the terminology and style established in previous sections
      - Do NOT duplicate content already documented
      - Focus on NEW business logic and rules in this chunk
    `
  },

  /** Final chunk instructions */
  finalChunkInstructions: {
    content: stripIndent`
      **Instructions:**
      - Analyze this final chunk and integrate any new business processes or rules
      - Complete any incomplete sections from the current document
      - Ensure the document has all required sections: Overview, Process Flow Overview, Detailed Phases, and Business Rule Reference
      - Polish the document to ensure it meets all quality checklist requirements
      - Make sure the final document is complete, cohesive, and ready for business stakeholders
      - Ensure proper business language throughout (no technical jargon)
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
