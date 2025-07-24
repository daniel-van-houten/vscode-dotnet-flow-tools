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
      <code_trace>
      ${codeTrace}
      </code_trace>
    `;
  }
};