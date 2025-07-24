import { PromptComponent } from '../../types';
import { PromptBuildContext } from '../../types';
import { stripIndent } from 'common-tags';

/**
 * Business context integration component
 */
export const BusinessContextComponent: PromptComponent = {
  content: ({ businessContext }: PromptBuildContext) => {
    if (!businessContext?.trim()) {
      return '';
    }
    return stripIndent`
      ## Business Domain Context

      Consider this business domain context when generating documentation:

      ${businessContext}
    `;
  }
};