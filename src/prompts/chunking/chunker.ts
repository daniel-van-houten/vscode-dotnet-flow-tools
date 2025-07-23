import { ParsedTrace, ChunkInfo, CodeSection } from './types';
import { getComponentContent } from '../template-builder/components';
import { PromptBuildContext } from '../template-builder/types';
import { IModelProvider } from '../../providers/IModelProvider';
import { chunkingDecisionEngine } from './ChunkingDecisionEngine';

/**
 * Unified adaptive chunking algorithm that respects method boundaries
 * while maximizing token utilization within model limits
 */
export async function chunkTrace(
  parsedTrace: ParsedTrace,
  provider: IModelProvider
): Promise<ChunkInfo[]> {
  const { callGraph, codeSections } = parsedTrace;

  // First check if we even need chunking using centralized decision engine
  const completeContent = buildCompleteTraceContent(parsedTrace);
  const needsChunking = await chunkingDecisionEngine.shouldChunk(completeContent, provider);

  if (!needsChunking) {
    console.log('[DEBUG] Content fits in single chunk, no chunking needed');
    return [await createChunk(callGraph, codeSections)];
  }

  // Calculate the maximum total input we can use (reserving space for output)
  const maxInputTokens = provider.tokenManager.getMaxInputTokens(provider.currentModelId);
  const maxOutputTokens = provider.tokenManager.getMaxOutputTokens(provider.currentModelId);
  const safetyBuffer = 500; // Small buffer for prompt variations and safety
  const maxTotalInputAllowed = maxInputTokens - maxOutputTokens - safetyBuffer;

  // Calculate the fixed components that appear in every chunk
  const callGraphTokens = await provider.tokenManager.countTokens(callGraph, provider.currentModelId);
  const chunkAnalysisInstructionsContent = getComponentContent('chunkAnalysisInstructions', { chunkIndex: 1, totalChunks: 1 } as PromptBuildContext);
  const chunkAnalysisInstructionsTokens = await provider.tokenManager.countTokens(chunkAnalysisInstructionsContent, provider.currentModelId);
  const fixedTokensPerChunk = callGraphTokens + chunkAnalysisInstructionsTokens;

  // Calculate how much space is available for actual code content in each chunk
  const availableTokensPerChunk = maxTotalInputAllowed - fixedTokensPerChunk;

  console.log(`[DEBUG] Chunking calculation:`);
  console.log(`  maxInputTokens: ${maxInputTokens}`);
  console.log(`  callGraphTokens: ${callGraphTokens}`);
  console.log(`  chunkAnalysisInstructionsTokens: ${chunkAnalysisInstructionsTokens}`);
  console.log(`  maxOutputTokens: ${maxOutputTokens}`);
  console.log(`  safetyBuffer: ${safetyBuffer}`);
  console.log(`  availableTokensPerChunk: ${availableTokensPerChunk}`);
  console.log(`  codeSections.length: ${codeSections.length}`);

  if (availableTokensPerChunk <= 0) {
    throw new Error(
      `Token budget exceeded by required components:\n` +
      `Model max tokens: ${maxInputTokens}\n` +
      `Required: callGraph(${callGraphTokens}) + chunkAnalysisInstructions(${chunkAnalysisInstructionsTokens}) + ` +
      `maxOutput(${maxOutputTokens}) + safetyBuffer(${safetyBuffer}) = ${callGraphTokens + chunkAnalysisInstructionsTokens + maxOutputTokens + safetyBuffer}`
    );
  }

  const chunks: ChunkInfo[] = [];
  let currentSections: CodeSection[] = [];
  let currentTokens = 0;

  // Process each code section
  for (let i = 0; i < codeSections.length; i++) {
    const section = codeSections[i];
    const sectionTokens = await provider.tokenManager.countTokens(section.content, provider.currentModelId);

    // Debug logging for first few sections
    if (i < 5) {
      console.log(`[DEBUG] Section ${i}: ${section.method} = ${sectionTokens} tokens, currentTokens = ${currentTokens}, willExceed = ${currentTokens + sectionTokens > availableTokensPerChunk}`);
    }

    // Check if adding this section would exceed token limit
    if (currentTokens + sectionTokens > availableTokensPerChunk && currentSections.length > 0) {
      // Finalize current chunk
      chunks.push(await createChunk(callGraph, currentSections));
      console.log(`[DEBUG] Created chunk ${chunks.length} with ${currentSections.length} methods, ~${currentTokens} tokens`);

      // Start new chunk with overlap from previous chunk
      const overlapTokenBudget = Math.min(1000, Math.floor(availableTokensPerChunk * 0.1)); // 10% of available space or 1000, whichever is smaller
      currentSections = await calculateOverlap(currentSections, overlapTokenBudget, provider.tokenManager, provider.currentModelId);
      currentTokens = await calculateSectionsTokens(currentSections, provider.tokenManager, provider.currentModelId);
      console.log(`[DEBUG] Starting new chunk with ${currentSections.length} overlap sections, ${currentTokens} tokens`);
    }

    // Add current section
    currentSections.push(section);
    currentTokens += sectionTokens;

    // Handle edge case: single section exceeds budget
    if (sectionTokens > availableTokensPerChunk) {
      console.warn(
        `[DEBUG] Large method ${section.file}:${section.method} (${sectionTokens} tokens) ` +
        `exceeds chunk budget (${availableTokensPerChunk} tokens). Including in isolated chunk.`
      );

      // If we have other sections, create a chunk without this large one
      if (currentSections.length > 1) {
        currentSections.pop();
        currentTokens -= sectionTokens;

        chunks.push(await createChunk(callGraph, currentSections));
        console.log(`[DEBUG] Created chunk ${chunks.length} with ${currentSections.length} methods`);

        // Reset for the large section
        currentSections = [section];
        currentTokens = sectionTokens;
      }
    }
  }

  // Add final chunk if there are remaining sections
  if (currentSections.length > 0) {
    chunks.push(await createChunk(callGraph, currentSections));
    console.log(`Created final chunk ${chunks.length} with ${currentSections.length} methods`);
  }

  // Log chunking summary
  console.log(
    `Chunking complete: ${codeSections.length} methods distributed across ${chunks.length} chunks. ` +
    `Average ${Math.ceil(codeSections.length / chunks.length)} methods per chunk.`
  );

  return chunks;
}

/**
 * Creates a chunk with proper structure
 */
async function createChunk(
  callGraph: string,
  sections: CodeSection[]
): Promise<ChunkInfo> {
  const chunkContent = buildChunkContent(callGraph, sections);

  return {
    content: chunkContent,
    sections: [...sections]
  };
}

/**
 * Builds chunk content by combining call graph with code sections
 */
function buildChunkContent(callGraph: string, sections: CodeSection[]): string {
  const codeContent = sections.map(s => s.content).join('\n\n');

  return `${callGraph}

<!-- CODE-BEGIN -->
${codeContent}
<!-- CODE-END -->`;
}

/**
 * Calculates overlap sections from the current chunk
 */
async function calculateOverlap(
  sections: CodeSection[],
  overlapTokens: number,
  tokenManager: any,
  modelId: string
): Promise<CodeSection[]> {
  if (sections.length === 0 || overlapTokens === 0) {
    return [];
  }

  const overlapSections: CodeSection[] = [];
  let currentOverlapTokens = 0;

  // Take sections from the end (most recent) up to the overlap limit
  for (let i = sections.length - 1; i >= 0; i--) {
    const section = sections[i];
    const sectionTokens = await tokenManager.countTokens(section.content, modelId);

    if (currentOverlapTokens + sectionTokens <= overlapTokens) {
      overlapSections.unshift(section); // Add to beginning to maintain order
      currentOverlapTokens += sectionTokens;
    } else {
      break;
    }
  }

  return overlapSections;
}

/**
 * Calculates total tokens for a list of sections
 */
async function calculateSectionsTokens(
  sections: CodeSection[],
  tokenManager: any,
  modelId: string
): Promise<number> {
  let total = 0;
  for (const section of sections) {
    total += await tokenManager.countTokens(section.content, modelId);
  }
  return total;
}


/**
 * Builds complete trace content as it would appear in a single-shot prompt
 */
function buildCompleteTraceContent(parsedTrace: ParsedTrace): string {
  const { callGraph, codeSections } = parsedTrace;
  const codeContent = codeSections.map(s => s.content).join('\n\n');

  return `${callGraph}

<!-- CODE-BEGIN -->
${codeContent}
<!-- CODE-END -->`;
}
