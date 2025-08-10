/**
 * Helpers to parse/format the combined model setting (`dotnetFlow.model`).
 *
 * Goals:
 * - Single, canonical parsing/formatting logic
 * - Trim and normalize whitespace
 * - Persist with spaces around the pipe: "provider | model"
 *
 * Examples:
 * - "built-in | GPT-4o" => { providerId: "built-in", modelToken: "GPT-4o" }
 * - "bedrock | us.anthropic.claude-3-5-sonnet-20240620-v1:0" => { providerId: "bedrock", modelToken: "us.anthropic.claude-3-5-sonnet-20240620-v1:0" }
 */

/**
 * Result type for a parsed combined model value.
 */
export interface CombinedModelSelection {
  providerId: string;
  modelToken: string;
}

/**
 * Parse a combined model value (e.g., "provider|model") into tokens.
 *
 * Behavior:
 * - Returns null for non-string, empty, or missing '|' separator
 * - Trims whitespace around both provider and model tokens
 * - Allows empty provider or model tokens (returned as empty strings) if a '|' exists
 */
export function parseCombinedModel(
  value: unknown,
): CombinedModelSelection | null {
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const sepIndex = raw.indexOf("|");
  if (sepIndex < 0) {
    return null;
  }

  const providerId = raw.slice(0, sepIndex).trim();
  const modelToken = raw.slice(sepIndex + 1).trim();

  // If both are empty, treat as not set
  if (!providerId && !modelToken) {
    return null;
  }

  return { providerId, modelToken };
}

/**
 * Format a combined model value by normalizing whitespace and removing padding.
 * Always returns "provider | model" with spaces around the pipe.
 *
 * Inputs are trimmed before formatting.
 */
export function formatCombinedModel(
  providerId: string,
  modelNameOrId: string,
): string {
  const p = (providerId ?? "").trim();
  const m = (modelNameOrId ?? "").trim();
  return `${p} | ${m}`;
}

/**
 * Normalize an arbitrary combined model value into canonical "provider | model" form.
 *
 * - Trims and removes extra spaces around the separator.
 * - Returns null if input cannot be parsed.
 */
export function normalizeCombinedModel(value: unknown): string | null {
  const parsed = parseCombinedModel(value);
  if (!parsed) {
    return null;
  }
  return formatCombinedModel(parsed.providerId, parsed.modelToken);
}
