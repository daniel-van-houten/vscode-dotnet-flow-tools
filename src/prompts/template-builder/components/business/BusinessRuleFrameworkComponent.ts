import { PromptComponent } from '../../types';
import { ContentLoader } from '../../content-loader';

/**
 * Business rule narrative framework component
 */
export const BusinessRuleFrameworkComponent: PromptComponent = {
  get content() {
    return ContentLoader.loadContent('business-rule-framework.md');
  }
};
