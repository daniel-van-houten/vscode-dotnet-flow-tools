import { processDocumentation, analyzeProcessingApproach } from './chunking';
import { IModelProvider } from '../providers/IModelProvider';

/**
 * Main unified processing function for documentation generation
 * Automatically determines whether to use single-shot or chunked approach
 */
export async function processDocumentationWithChunking(
  traceContent: string,
  provider: IModelProvider,
  context: { className: string; methodName: string },
  businessContext?: string,
  cancellationToken?: any, // vscode.CancellationToken
  progressCallback?: (message: string, increment?: number) => void
): Promise<{
  content: string;
  approach: 'single-shot' | 'chunked';
  chunkCount?: number;
}> {
  const result = await processDocumentation(
    traceContent,
    provider,
    context,
    businessContext,
    cancellationToken,
    progressCallback
  );

  // Append model metadata to the document
  const modelInfo = getProviderDisplayName(provider);
  const timestamp = new Date().toLocaleString();
  const approachText = result.approach === 'single-shot'
    ? 'Single-shot'
    : `Chunked (${result.chunkCount} ${result.chunkCount === 1 ? 'chunk' : 'chunks'})`;

  const metadata = `\n\n---\n\n**Documentation Generation Details**\n- Model Used: ${modelInfo}\n- Processing Approach: ${approachText}\n- Generated: ${timestamp}\n\n---`;

  return {
    content: result.content + metadata,
    approach: result.approach,
    chunkCount: result.chunkCount
  };
}

/**
 * Analyzes a trace and returns processing recommendations
 */
export async function analyzeTrace(
  traceContent: string,
  provider: IModelProvider
): Promise<{
  approach: 'single-shot' | 'chunked';
  estimatedTokens: number;
  maxTokens: number;
  chunkCount?: number;
  recommendation: string;
}> {
  return analyzeProcessingApproach(traceContent, provider);
}

/**
 * Unified processing function that replaces the experimental chunking
 * The system now automatically determines optimal chunking based on content
 */
export async function processDocumentationWithExperimentalChunking(
  traceContent: string,
  provider: IModelProvider,
  context: { className: string; methodName: string },
  _desiredChunkCount: number = 2, // Parameter kept for backward compatibility but ignored
  businessContext?: string,
  cancellationToken?: any // vscode.CancellationToken
): Promise<{
  content: string;
  approach: 'chunked';
  chunkCount: number;
  desiredChunkCount: number;
}> {
  // Use the unified processing function
  const result = await processDocumentation(
    traceContent,
    provider,
    context,
    businessContext,
    cancellationToken
  );

  // Append model metadata to the document
  const modelInfo = getProviderDisplayName(provider);
  const timestamp = new Date().toLocaleString();
  const chunkText = result.chunkCount === 1 ? 'chunk' : 'chunks';
  const metadata = `\n\n---\n\n**Documentation Generation Details**\n- Model Used: ${modelInfo}\n- Processing Approach: Adaptive Chunking (${result.chunkCount} ${chunkText})\n- Generated: ${timestamp}\n\n---`;

  return {
    content: result.content + metadata,
    approach: 'chunked',
    chunkCount: result.chunkCount,
    desiredChunkCount: result.chunkCount // Return actual count for compatibility
  };
}

/**
 * Helper function to get a friendly display name for the provider
 */
function getProviderDisplayName(provider: IModelProvider): string {
  return `${provider.id} provider`;
}


// Re-export types for convenience
export type { PromptComponent } from './template-builder/types';
