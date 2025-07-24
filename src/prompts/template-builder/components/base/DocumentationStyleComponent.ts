import { PromptComponent } from '../../types';
import { stripIndent } from 'common-tags';

/**
 * Documentation style and formatting guidelines component
 */
export const DocumentationStyleComponent: PromptComponent = {
  content: stripIndent`
    ## Documentation Style and Formatting Guide

    ### Core Principle to Good Documentation
    Write as if explaining to a business stakeholder who needs to understand the process but doesn't need technical implementation details.

    ### Structure Requirements
    1. **Overview Section** - High-level summary of what this process accomplishes
    2. **Process Flow** - Step-by-step breakdown of the business logic
    3. **Business Rules** - Validation criteria and decision points
    4. **Data Requirements** - What information is needed and produced
    5. **Edge Cases** - Special scenarios and how they're handled
  `
};