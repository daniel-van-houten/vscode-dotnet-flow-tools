import { ComponentRegistry } from "../types";
import { stripIndent } from "common-tags";

/**
 * Chunking-specific components for processing large traces
 */
export const chunkingComponents: Partial<ComponentRegistry> = {
  /** Instructions for chunk analysis with position-aware guidance */
  chunkAnalysisInstructions: {
    content: ({
      chunkIndex,
      totalChunks,
      className,
      methodName,
      chunkPosition,
    }) => {
      const isFirstChunk = chunkPosition === "first" || chunkIndex === 1;
      const isLastChunk =
        chunkPosition === "last" || chunkIndex === totalChunks;
      const isMiddleChunk = !isFirstChunk && !isLastChunk;

      return stripIndent`
        # Current Task: Analyzing ${className}.${methodName}

        ## Processing Status
        You are analyzing chunk ${chunkIndex} of ${totalChunks}.

        ${
          isFirstChunk
            ? stripIndent`
        ## First Chunk Guidelines
        This is the **foundation chunk**. Your responsibilities:

        ### Establish Foundation
        1. **Create Documentation Structure**: Set up the main sections and organization
        2. **Identify Core Flow**: Map the primary business process path and entry points
        3. **Define Business Entities**: Establish key business terms and entities encountered
        4. **Flag Dependencies**: Note any references to code not yet analyzed

        ### Output Requirements
        - Create a well-structured foundation that future chunks will build upon
        - Use clear, consistent terminology that subsequent chunks will follow
        - Mark incomplete sections with **[CONTINUING IN NEXT CHUNK]** where applicable
        `
            : isLastChunk
              ? stripIndent`
        ## Final Chunk Guidelines
        This is the **synthesis chunk**. Your responsibilities:

        ### Complete Integration
        1. **Resolve Open Items**: Address any pending questions from previous chunks
        2. **Synthesize Findings**: Create cohesive summary of the entire process
        3. **Validate Completeness**: Ensure all major code paths are documented
        4. **Polish Output**: Refine for consistency and readability across all sections

        ### Output Requirements
        - Provide the **COMPLETE, INTEGRATED** documentation for the entire process
        - Ensure it reads as a unified document, not separate analyses
        - Remove any **[CONTINUING]** placeholders and complete all sections
        `
              : stripIndent`
        ## Continuation Guidelines
        This is a **middle chunk**. Your responsibilities:

        ### Build Upon Previous Work
        1. **Extend Documentation**: Add new insights without restating previous findings
        2. **Resolve References**: Complete any cross-references from previous chunks
        3. **Maintain Consistency**: Follow established terminology and detail level
        4. **Bridge Connections**: Link this chunk's findings to previous documentation

        ### Output Requirements
        - Extend existing documentation naturally and seamlessly
        - Use **[CONTINUING IN NEXT CHUNK]** for incomplete sections
        - Reference previous findings when adding new context
        `
        }

        ## Integration Requirements
        ${
          !isFirstChunk
            ? stripIndent`
        ### How to Integrate with Previous Work
        - **Extend, Don't Repeat**: Add new insights without restating previous findings
        - **Resolve References**: If previous chunks referenced methods/classes in this chunk, complete those sections
        - **Update Understanding**: If this chunk reveals new context about previous findings, note the refinement
        - **Maintain Structure**: Follow the documentation structure established in chunk 1
        `
            : ""
        }

        ## Key Analysis Points
        - **Complete Code Call Graph Provided**: The full call graph for the entire process is included in each chunk to help you understand where the current subset of methods fits within the overall execution flow
        - **Contextual Understanding**: Use the call graph to see how this chunk's methods relate to the broader process and other components
        - Extract business logic and rules specific to this chunk's functionality
        - Focus on business value and process flow, not technical implementation details
        - Maintain consistency with the overall business process narrative

        ${
          isLastChunk
            ? stripIndent`
        ## Final Quality Checks
        Before completing, ensure:
        - Consistent terminology throughout the document
        - Logical flow from process start to finish
        - All cross-references are resolved
        - Complete coverage of major code paths
        `
            : ""
        }
      `;
    },
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
      `,
  },

  /** Previous document context wrapper */
  previousDocumentContext: {
    content: ({ previousDocument, progressiveContext, chunkPosition }) => {
      const isFirstChunk = chunkPosition === "first";

      if (isFirstChunk || !previousDocument) {
        return "";
      }

      // Use structured summary if available, otherwise fallback to full text
      if (progressiveContext?.documentationSummary) {
        const summary = progressiveContext.documentationSummary;
        let content = stripIndent`
          ## Documentation Built So Far

          **Main Purpose:** ${summary.mainPurpose || "Not yet established"}

          **Key Business Steps Documented:**
        `;

        if (summary.keySteps && summary.keySteps.length > 0) {
          content += summary.keySteps
            .map((step) => `- **${step.step}**: ${step.businessLogic}`)
            .join("\n");
        } else {
          content += "\n- No key steps documented yet";
        }

        if (summary.businessRules && summary.businessRules.length > 0) {
          content += stripIndent`

            **Business Rules Identified:**
            ${summary.businessRules.map((rule) => `- ${rule}`).join("\n")}
          `;
        }

        if (
          progressiveContext.identifiedPatterns &&
          progressiveContext.identifiedPatterns.length > 0
        ) {
          content += stripIndent`

            **Patterns Identified:**
            ${progressiveContext.identifiedPatterns.map((pattern) => `- ${pattern}`).join("\n")}
          `;
        }

        if (
          progressiveContext.pendingQuestions &&
          progressiveContext.pendingQuestions.length > 0
        ) {
          content += stripIndent`

            **Open Questions from Previous Chunks:**
            ${progressiveContext.pendingQuestions.map((q) => `- ${q}`).join("\n")}
          `;
        }

        return content;
      }

      // Fallback to previous document approach for backwards compatibility
      return stripIndent`
        ## Documentation Built So Far
        \`\`\`
        ${previousDocument}
        \`\`\`
      `;
    },
  },

  /** Combined chunk analyses */
  chunkAnalyses: {
    content: ({ chunkAnalyses, chunkCount }) => {
      if (!chunkAnalyses) {
        return "";
      }
      return stripIndent`
        **Combined Analyses from ${chunkCount} Code Chunks:**

        ${chunkAnalyses}
      `;
    },
  },
};
