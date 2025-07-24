import { PromptComponent } from '../../types';
import { ContentLoader } from '../../content-loader';

/**
 * Core business documentation instructions component
 */
export const BaseInstructionsComponent: PromptComponent = {
  get content() {
    return ContentLoader.loadContent('base-instructions.md');
  }
};
