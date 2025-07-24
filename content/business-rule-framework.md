# Business Rule Integration Framework

Business rules should be woven naturally throughout your documentation, not isolated in tables or appendices. They are the "why" behind the processes and should feel like an integral part of the business story.

## Rule Categories to Identify

As you analyze code, look for these types of business rules:

1. **Validation Rules** - Requirements that must be met for data or actions to be valid
2. **Calculation Rules** - How values are computed, derived, or transformed
3. **Authorization Rules** - Who can do what under which circumstances
4. **State Transition Rules** - How and when things change from one state to another
5. **Temporal Rules** - Time-based constraints, deadlines, and scheduling requirements
6. **Relationship Rules** - How different entities relate to and depend on each other
7. **Business Policy Rules** - Overarching business decisions, strategies, and exceptions

## Integration Approach

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
- `if (customer.accountType == "PREMIUM")` → "Premium customers receive..."
- `order.items.any(i => i.isHazmat)` → "Orders containing hazardous materials..."
- `DateTime.Now > order.dueDate` → "When delivery deadlines are missed..."

**Show rule interactions:**
Explain how multiple rules work together in realistic scenarios. For example: "A $15,000 order from a 6-year customer would bypass approval requirements if they're Premium-tier, include special handling if containing hazmat items, and receive a 10% loyalty discount on the subtotal."

## Rule Documentation Pattern

For each significant rule, include:
- **What happens** (the rule's action or constraint)
- **When it applies** (the trigger conditions in business terms)
- **Why it exists** (the business rationale)
- **How it affects the process** (the business outcome)
- **Any exceptions** (edge cases or overrides)

Remember: Rules should enhance the narrative flow, not interrupt it. They should feel like natural explanations of how the business operates, not technical specifications.