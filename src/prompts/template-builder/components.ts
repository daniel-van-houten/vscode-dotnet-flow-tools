import { ComponentRegistry, PromptBuildContext } from './types';
import { stripIndent } from 'common-tags';

// Import only the chunking components - other components are defined directly here
import { chunkingComponents } from './components/chunking';

/**
 * Registry of all prompt components that can be used in templates
 */
export const promptComponents: ComponentRegistry = {
  ...chunkingComponents,
  
  /** Base instructions - the core business documentation instructions */
  baseInstructions: {
    content: stripIndent`
      ## Primary Instruction

      You are a business domain expert who translates technical implementations into clear business process documentation. Your task is to analyze code files and produce a comprehensive business domain guide that explains the underlying business logic WITHOUT any technical references.

      ## Input Processing Rules

      ### What You'll Receive
      - Code files (classes, methods, functions, etc.)
      - Technical implementations of business processes
      - Validation logic, calculations, and workflows

      ### What You Must Extract
      - Business rules and their purposes
      - Process flows and decision points
      - Data relationships and dependencies
      - Validation criteria and their business rationale
      - Financial calculations and their business context

      ## Transformation Guidelines

      ### Language Constraints
      **Avoid these types of terms:**
      - program, application
      - method, function, class, object, variable
      - database, table, field, record
      - API, service, interface, component
      - code, implementation, technical

      **TRY to avoid these types of terms:**
      - system, application

      **INSTEAD use these types of business terms:**
      - process, workflow, procedure
      - business rule, validation, requirement
      - information, data, details
      - calculation, determination, assessment
      - record, document, entry

      ## Documentation Style and Formatting Guide

      ### Core Principle to Good Documentation
      | Principle          | Why it matters         | How to apply in Markdown                                                                                                 |
      | ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
      | **Plain Language** | Reduces cognitive load | Write as if you were explaining to a smart 12-year-old; replace "utilize" with "use"; avoid acronyms unless spelled out. |
      | **Scannability**   | Readers skim first     | Short sections, descriptive headings, ≤ 80-character lines, generous white-space.                                        |
      | **Visual Rhythm**  | Aids comprehension     | Alternate text with lists, callouts, and images; avoid walls of text.                                                    |

      ### Writing Style
      - Use **second person** ("you") and active voice.
      - Keep sentences ≤ 25 words; paragraphs ≤ 4 lines.
      - Define domain terms on first use; link to glossary.

      ### Headings
      - Heading hierarchy: Never skip a level; one # H1 per page.
      - Never Skip over a heading size : # > ###

      ### Emphasis
      | Use                 | Syntax     | Example     |
      | ------------------- | ---------- | ----------- |
      | *Light emphasis*    | \`*text*\`   | *Tip*       |
      | **Strong emphasis** | \`**text**\` | **Warning** |

      ### Lists
      - Use bullet points for related ideas, but limit to support narrative
      - Use numbered lists for steps in a process
      - Do not exceed two levels of nesting
      - Always surround lists with explanatory text for context

      ### Tables
      - Use simplified, business-friendly tables.
      - Tables should prioritize clarity for non-technical readers (avoid markdown clutter where possible).
      | Description | Impact |
      |-------------|--------|
      | Notes must be provided with an order | Ensures meaningful tracking and communication |

      ### Mermaid Flowcharts
      Use \`flowchart TD\` to describe a process. Your generated flowcharts should follow the structure and clarity of this example, which demonstrates best practices for creating readable and maintainable diagrams.

      **Key Features to Emulate:**
      - **Clear Sections:** Use comments (\`%%\`) to delineate logical sections and business phases.
      - **Group with Subgraphs:** Use subgraphs to visually group related steps into logical phases.
      - **Separate Global Flow:** Define the high-level connections between subgraphs and terminal nodes last to clarify the overall process.

      **A Simple Flowchart Example:**
      \`\`\`mermaid
      flowchart TD
      %% Order Validation Subgraph
      subgraph "Validate the Order"
      direction TB
      ReceiveOrder([Receive Customer Order])
      FraudCheck[[Run Fraud Detection]]
      IsValid{Is the Order Valid?}
      InvalidNotice[/Send Invalid Order Notice/]

      ReceiveOrder --> FraudCheck
      FraudCheck --> IsValid
      IsValid -- No --> InvalidNotice
      end

      %% Inventory Handling Subgraph
      subgraph "Check Inventory"
      direction TB
      CheckInventory[[Query Inventory System]]
      InStock{Items In Stock?}
      ReserveItems[["Reserve Items in Stock"]]
      ContactSupplier{{Contact Supplier for Restock}}
      BackorderNotice[/Send Back-Order Notice/]

      CheckInventory --> InStock
      InStock -- Yes --> ReserveItems
      InStock -- No --> ContactSupplier
      ContactSupplier --> BackorderNotice
      end

      %% Billing Subgraph
      subgraph "Process Payment"
      direction TB
      AttemptPayment[[Attempt Customer Payment]]
      PaymentGateway{{Connect to Payment Gateway}}
      PaymentSuccess{Payment Successful?}
      PaymentFailed[/Send Payment Failed Notice/]
      GenerateReceipt[["Generate Customer Receipt"]]

      AttemptPayment --> PaymentGateway
      PaymentGateway --> PaymentSuccess
      PaymentSuccess -- No --> PaymentFailed
      PaymentSuccess -- Yes --> GenerateReceipt
      end

      %% Fulfilment Subgraph
      subgraph "Fulfill the Order"
      direction TB
      PickItems(["Pick Items from Warehouse"])
      PackOrder>Pack the Order]
      PrintLabel[/"Print Shipping Label"\\]
      ShipOrder{{Ship via Carrier}}
      SendConfirmation[/Send Tracking Confirmation/]

      PickItems --> PackOrder
      PackOrder --> PrintLabel
      PrintLabel --> ShipOrder
      ShipOrder --> SendConfirmation
      end

      %% Overall Process Flow
      Start((Order Process Starts)) --> ReceiveOrder

      IsValid -- Yes --> CheckInventory

      ReserveItems --> AttemptPayment

      GenerateReceipt --> PickItems

      InvalidNotice --> OrderCancelled{{"Order Cancelled"}}
      BackorderNotice --> OrderCancelled
      PaymentFailed --> OrderCancelled

      SendConfirmation --> OrderComplete((Order Complete))
      OrderComplete --> ArchiveOrder[["Archive Order Record"]]

      OrderCancelled --> End((End))
      ArchiveOrder --> End((End))

      \`\`\`

      **Symbol Requirements**
      - The start should be defined like this: start([<Step Name Here>])
      - The end should be defined like this: complete((End))
      - Stopping Steps are defined like this: A@{ shape: dbl-circ, label: "Stop" }
      - If you are using the word "end" in a Flowchart node, capitalize the entire word or any of the letters (e.g., "End" or "END"), or apply this workaround. Typing "end" in all lowercase letters will break the Flowchart.

      **Additional Symbol Options**
      - A@{ shape: lean-l, label: "Output/Input" }
      - A@{ shape: trap-t, label: "Manual operation" }
      - A@{ shape: brace-r, label: "Comment" }

      ### Inline Components
      | Component | Syntax (GitHub-flavored)                      | Purpose                          |
      | --------- | --------------------------------------------- | -------------------------------- |
      | Task list | \`- [ ]\` / \`- [x]\`                             | Interactive check-offs.          |
      | Details   | \`<details><summary>Why?</summary>…</details>\` | Hide advanced info.              |
      | Footnotes | \`word[^1]\` then \`[^1]: text\`                  | Cite references without clutter. |

      ### Document Structure Guidance

      Your output must follow this balanced, readable format that blends narrative flow with structured elements for clarity and engagement. While the structure ensures clarity, adapt it to create a document with natural flow and balance. Use your judgment for processes that are simple, complex, or linear.

      **Core Sections**
      1. **Title**: [Business Process Name based on code entry point]
      2. **Overview**: A cohesive paragraph (or two at most) that summarizes what the process does.
      3. **Process Flow Overview**: A complete Mermaid diagram of the process flow, capturing all steps and decision points. While comprehensive, the diagram should group related steps to provide a clear, high-level overview of the business logic.
      4. **Detailed Phases**: For each phase, provide a narrative explanation that naturally incorporates business rules and their rationale. Use lists and tables sparingly to enhance clarity.
      5. **Common Scenarios**: 2-3 realistic examples described in narrative form that demonstrate how the rules work in practice.

      **Structural Flexibility**
      You MAY:
      - Blend phases with transitional narrative if they connect closely.
      - Omit the Mermaid diagram if the flow is strictly linear or trivial.
      - Introduce optional sections like "FAQs," or "Edge Cases."
      - Vary the use of lists and tables to avoid repetition, favoring narrative where it improves connectivity while also trying to avoid walls of text.

      You MUST:
      - Include a title, overview, and examples.
      - Document all business logic, decisions, and outcomes naturally within the narrative.
      - Weave business rules and their rationale throughout the detailed phases.

      You MUST NOT:
      - Use technical language or software engineering terminology.
      - Skip conditional logic, validations, or outcomes.
      - Over-rely on tables or lists; always intersperse with explanatory prose.
      - Attempt to expand acronyms.

      When in doubt, prioritize **clarity, business meaning, and readable flow** over format rigidity. The document should feel like a cohesive guide, not a disjointed list.

      ## Analysis Framework

      When analyzing code, use the following transformation logic:

      ### 1. Identify Business Entities
      - Domain objects → Business concepts
      - Enums/constants → Business categories
      - Validation checks → Business rules

      ### 2. Map Technical Flow to Business Process
      - 'if'/'else' → Business decisions
      - Loops → Repeated business actions
      - Try/catch → Error or rule violation handling
      - External calls → Dependencies on other business processes

      ### 3. Transform Validations and Rules

      **Financial Rules:**
      - \`if (order.amount > purchaseOrder.limit * 1.03)\` → "Total cost cannot exceed PO amount + 3% tolerance"
      - \`order.discount = Math.min(order.discount, 0.15)\` → "Discounts are capped at 15% to maintain margin requirements"

      **Authorization Rules:**
      - \`if (customer.accountType == "FIRM" && !item.isPriceLocked())\` → "Firm/Fixed accounts require locked retail pricing"
      - \`if (user.role != "Manager" && order.amount > 5000)\` → "Orders above $5,000 require manager authorization"

      **State Transition Rules:**
      - \`if (order.status == "Pending" && payment.isApproved)\` → "Orders move to processing once payment is confirmed"
      - \`if (inventory.quantity < order.quantity)\` → "Insufficient inventory triggers back-order procedures"

      **Temporal Rules:**
      - \`if (DateTime.Now > order.deliveryDate.AddDays(-2))\` → "Rush processing applies when delivery is within 2 days"
      - \`if (customer.lastOrderDate < DateTime.Now.AddMonths(-12))\` → "Dormant customer reactivation procedures apply after 12 months"

      **Calculation Rules:**
      - \`tax = subtotal * (customer.taxExempt ? 0 : 0.08)\` → "Tax-exempt customers pay no sales tax; others pay 8%"
      - \`shipping = weight > 50 ? weight * 0.15 : 9.99\` → "Shipping is $9.99 for orders under 50 lbs, otherwise $0.15 per pound"

      Quality Checklist

      Before finalizing output, ensure:
      - The document reads like a business operations manual with smooth momentum — not a technical spec or disjointed list.
      - All business rules are explained in plain terms with business rationale.
      - At least two realistic, business-driven examples are included.
      - Passive voice is minimized.
      - Narrative connects sections, creating a sense of progression.

      Meta-Instructions
      1. Read all provided code first before writing.
      2. Group related functionality into logical business phases.
      3. Prioritize clarity and flow over exact code coverage.
      4. Focus on the "what" and "why", never the "how."
      5. Write for non-technical business analysts — not engineers.

      Final Output Format

      Return the complete documentation in a single Markdown artifact. It should be immediately usable as:
      - Training material for business users
      - Reference guide for business analysts
      - Audit-ready process documentation
      - Onboarding content for non-technical stakeholders

      Remember: Your reader doesn't care about how the code works. They only care about what the process does, why it exists, and what business value it provides. Ensure the style balances structure with narrative for a compelling, easy-to-comprehend read. Beautiful docs feel effortless to readers because the author put the effort into clarity, structure, and polish

      {{businessRuleNarrativeFramework}}
    `
  },

  /** Documentation style and formatting guidelines */
  documentationStyle: {
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
  },

  /** Business context integration */
  businessContext: {
    content: ({ businessContext }) => {
      if (!businessContext?.trim()) {
        return '';
      }
      return stripIndent`
        ## Business Domain Context

        Consider this business domain context when generating documentation:

        ${businessContext}
      `;
    }
  },

  /** Code trace component */
  codeTrace: {
    content: ({ codeTrace }) => {
      if (!codeTrace) {
        return '';
      }
      return stripIndent`
        <code_trace>
        ${codeTrace}
        </code_trace>
      `;
    }
  },

  /** Chunk-specific components */
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
      - Ensure the document has all required sections: Overview, Process Flow Overview, Detailed Phases, Business Rule Reference, and Common Scenarios
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

  /** Single-shot specific note */
  singleShotNote: {
    content: 'Note: You are receiving the complete code trace in a single request. Create a comprehensive business process document following all the structure requirements above.'
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
  },

  /** Business rule narrative framework */
  businessRuleNarrativeFramework: {
    content: stripIndent`
      ## Business Rule Integration Framework

      Business rules should be woven naturally throughout your documentation, not isolated in tables or appendices. They are the "why" behind the processes and should feel like an integral part of the business story.

      ### Rule Categories to Identify

      As you analyze code, look for these types of business rules:

      1. **Validation Rules** - Requirements that must be met for data or actions to be valid
      2. **Calculation Rules** - How values are computed, derived, or transformed
      3. **Authorization Rules** - Who can do what under which circumstances
      4. **State Transition Rules** - How and when things change from one state to another
      5. **Temporal Rules** - Time-based constraints, deadlines, and scheduling requirements
      6. **Relationship Rules** - How different entities relate to and depend on each other
      7. **Business Policy Rules** - Overarching business decisions, strategies, and exceptions

      ### Integration Approach

      **Embed rules naturally within process descriptions:**
      - Don't create separate "rules" sections - weave them into the narrative flow
      - Use clear business language to explain the "why" behind each rule
      - Group related rules together in logical process phases
      - Use formatting (*emphasis*, **strong emphasis**) to highlight key constraints
      - Connect rules to their business outcomes and rationale

      **Example of good rule integration:**
      Instead of: "Rule: if order.amount > 10000 then requiresApproval = true"
      Write: "**Orders exceeding $10,000 require manager approval** to ensure appropriate oversight of significant transactions while maintaining efficient processing for smaller orders."

      **Transform technical conditions to business language:**
      - \`if (customer.accountType == "PREMIUM")\` → "Premium customers receive..."
      - \`order.items.any(i => i.isHazmat)\` → "Orders containing hazardous materials..."
      - \`DateTime.Now > order.dueDate\` → "When delivery deadlines are missed..."

      **Show rule interactions:**
      Explain how multiple rules work together in realistic scenarios. For example: "A $15,000 order from a 6-year customer would bypass approval requirements if they're Premium-tier, include special handling if containing hazmat items, and receive a 10% loyalty discount on the subtotal."

      ### Rule Documentation Pattern

      For each significant rule, include:
      - **What happens** (the rule's action or constraint)
      - **When it applies** (the trigger conditions in business terms)
      - **Why it exists** (the business rationale)
      - **How it affects the process** (the business outcome)
      - **Any exceptions** (edge cases or overrides)

      Remember: Rules should enhance the narrative flow, not interrupt it. They should feel like natural explanations of how the business operates, not technical specifications.
    `
  }
};

/**
 * Helper function to get a component's content
 */
export function getComponentContent(componentName: string, context: PromptBuildContext): string {
  const component = promptComponents[componentName];
  if (!component) {
    console.warn(`Component '${componentName}' not found in registry`);
    return `{{${componentName}}}`;
  }

  if (typeof component.content === 'function') {
    return component.content(context);
  }

  return component.content;
}
