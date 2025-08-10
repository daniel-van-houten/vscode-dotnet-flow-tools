import { ComponentRegistry, PromptBuildContext } from "./types";

// Direct component imports
import { BaseInstructionsComponent } from "./components/base/BaseInstructionsComponent";

import { BusinessContextComponent } from "./components/business/BusinessContextComponent";

import { CodeTraceComponent } from "./components/formatting/CodeTraceComponent";
import { chunkingComponents } from "./components/chunking";

/**
 * Registry of all prompt components (backward compatibility)
 */
export const promptComponents: ComponentRegistry = {
  // Base components
  baseInstructions: BaseInstructionsComponent,

  // Business components
  businessContext: BusinessContextComponent,

  // Formatting components
  codeTrace: CodeTraceComponent,

  // Chunking components
  ...chunkingComponents,
};

/**
 * Helper function to get a component's content (backward compatibility)
 */
export function getComponentContent(
  componentName: string,
  context: PromptBuildContext,
): string {
  const component = promptComponents[componentName];
  if (!component) {
    console.warn(`Component '${componentName}' not found in registry`);
    return `{{${componentName}}}`;
  }

  if (typeof component.content === "function") {
    return component.content(context);
  }

  return component.content;
}
