/**
 * Configuration section name
 */
export const CONFIG_SECTION = 'dotnetFlow' as const;

/**
 * Configuration keys for type-safe access
 */
export const CONFIG_KEYS = {
  CLI_BUILD: 'dotnetFlow.cliBuild',
  // Combined provider|model identifier for simplified configuration
  MODEL: 'dotnetFlow.model',
  AWS_PROFILE: 'dotnetFlow.awsProfile',
  AWS_REGION: 'dotnetFlow.awsRegion',
  BUSINESS_CONTEXT: 'dotnetFlow.businessContext'
} as const;

/**
 * Command identifiers
 */
export const COMMANDS = {
  DOCUMENT_THIS: 'dotnet-flow-tools.documentThis',
  TRACE_ALL: 'dotnet-flow-tools.traceThis.all',
  TRACE_METHODS_ONLY: 'dotnet-flow-tools.traceThis.methodsOnly',
  TRACE_MEDIATR_ONLY: 'dotnet-flow-tools.traceThis.mediatrOnly',
  SELECT_MODEL: 'dotnet-flow-tools.selectModel'
} as const;

/**
 * File patterns
 */
export const FILE_PATTERNS = {
  SOLUTION: '**/*.sln',
  DOCUMENTATION: '.flowdocs/Flow.{className}.{methodName}.md'
} as const;
