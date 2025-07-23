import { ParsedTrace, CodeSection } from './types';

/**
 * Parses the CLI output into structured components
 */
export function parseTrace(traceContent: string): ParsedTrace {
  // Extract call graph
  const callGraphMatch = traceContent.match(/<!--CALL-GRAPH-BEGIN-->([\s\S]*?)<!--CALL-GRAPH-END-->/);
  if (!callGraphMatch) {
    throw new Error('Call graph markers not found in trace content');
  }
  const callGraph = callGraphMatch[0]; // Include markers for consistency

  // Extract code sections
  const codeSections = parseCodeSections(traceContent);

  return {
    callGraph,
    codeSections
  };
}

/**
 * Parses code sections using the <!--§ ... --> markers
 */
function parseCodeSections(content: string): CodeSection[] {
  // Find the CODE-BEGIN/CODE-END block first
  const codeBlockMatch = content.match(/<!--CODE-BEGIN-->([\s\S]*?)<!--CODE-END-->/);
  if (!codeBlockMatch) {
    throw new Error('CODE-BEGIN/CODE-END markers not found');
  }

  const codeBlock = codeBlockMatch[1];
  
  // Split on the § markers, keeping the metadata
  const parts = codeBlock.split(/<!--§\s+/).slice(1); // Remove pre-code header
  
  const sections: CodeSection[] = [];
  
  for (const part of parts) {
    const section = parseCodeSection(part);
    if (section) {
      sections.push(section);
    }
  }

  return sections;
}

/**
 * Parses a single code section from a § marker part
 */
function parseCodeSection(part: string): CodeSection | null {
  // Extract the marker line (everything before the first -->)
  const markerEndIndex = part.indexOf('-->');
  if (markerEndIndex === -1) {
    return null;
  }

  const markerLine = part.substring(0, markerEndIndex).trim();
  const content = '<!--§ ' + part; // Restore the full section with marker

  // Parse the marker line: "File: OrderController.cs Class: OrderController Method: CreateOrder"
  const metadata = parseMarkerMetadata(markerLine);

  return {
    marker: markerLine,
    content,
    file: metadata.file,
    class: metadata.class,
    method: metadata.method || 'Unknown'
  };
}

/**
 * Parses metadata from a marker line
 */
function parseMarkerMetadata(markerLine: string): { file: string; class?: string; method?: string } {
  const result: { file: string; class?: string; method?: string } = { file: '' };

  // Parse patterns like "File: OrderController.cs Class: OrderController Method: CreateOrder"
  const fileMatch = markerLine.match(/File:\s*([^\s]+)/);
  if (fileMatch) {
    result.file = fileMatch[1];
  }

  const classMatch = markerLine.match(/Class:\s*([^\s]+)/);
  if (classMatch) {
    result.class = classMatch[1];
  }

  const methodMatch = markerLine.match(/Method:\s*([^\s]+)/);
  if (methodMatch) {
    result.method = methodMatch[1];
  }

  return result;
}

/**
 * Validates that a trace has the expected structure
 */
export function validateTraceStructure(content: string): { isValid: boolean; error?: string } {
  // Check for call graph markers
  if (!content.includes('<!--CALL-GRAPH-BEGIN-->') || !content.includes('<!--CALL-GRAPH-END-->')) {
    return { isValid: false, error: 'Missing call graph markers' };
  }

  // Check for code section markers
  if (!content.includes('<!--CODE-BEGIN-->') || !content.includes('<!--CODE-END-->')) {
    return { isValid: false, error: 'Missing code section markers' };
  }

  // Check for at least one § marker
  if (!content.includes('<!--§')) {
    return { isValid: false, error: 'No code sections found (missing § markers)' };
  }

  return { isValid: true };
}
