export interface CatalogModelInfo {
  id: string;
  name: string;
  description: string;
}

export interface ProviderCatalog {
  id: 'built-in' | 'bedrock';
  name: string;
  models: CatalogModelInfo[];
}

export const PROVIDERS_CATALOG: ProviderCatalog[] = [
  {
    id: 'built-in',
    name: 'VS Code Built-in',
    models: [
      { id: 'gpt-5', name: 'GPT-5 (Preview)', description: 'OpenAI - GPT-5' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI - GPT-4o' },
      { id: 'gpt-4.1', name: 'GPT-4.1', description: 'OpenAI - GPT-4.1' },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic - Claude 3.5 Sonnet' },
    ],
  },
  {
    id: 'bedrock',
    name: 'AWS Bedrock',
    models: [
      { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0', name: 'Claude Sonnet 4', description: 'Anthropic - Claude Sonnet 4' },
      { id: 'us.anthropic.claude-3-5-sonnet-20240620-v1:0', name: 'Claude Sonnet 3.5', description: 'Anthropic - Claude Sonnet 3.5' },
    ],
  },
];

export function getProviderDisplayName(providerId: string): string {
  const provider = PROVIDERS_CATALOG.find(p => p.id === providerId);
  return provider?.name ?? providerId;
}

export function getCatalogModelsForProvider(providerId: string): CatalogModelInfo[] {
  return PROVIDERS_CATALOG.find(p => p.id === providerId)?.models ?? [];
}


