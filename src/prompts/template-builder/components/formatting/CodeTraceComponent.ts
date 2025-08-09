import { PromptComponent } from '../../types';
import { PromptBuildContext } from '../../types';
import { stripIndent } from 'common-tags';

/**
 * Code trace wrapper component
 */
export const CodeTraceComponent: PromptComponent = {
  content: ({ codeTrace }: PromptBuildContext) => {
    if (!codeTrace) {
      return '';
    }
    return stripIndent`
      ## Code Trace And Methods
      This section contains the complete code call graph which shows all possible code paths from the starting point as well as methods extracted from the source code. It is essential for understanding the implementation details and logic flow of the business process.
      <code_trace>
      ${codeTrace}
      </code_trace>
    `;
  }
};