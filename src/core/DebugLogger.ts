import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Static counter for sequencing prompts within a session
 */
let promptSequence = 0;

/**
 * Reset the prompt sequence counter (useful for new documentation sessions)
 */
export function resetPromptSequence(): void {
  promptSequence = 0;
}

/**
 * Save LLM prompt and response to markdown file for debugging
 * Overwrites files from previous runs to keep only the latest session
 */
export async function savePromptDebug(
  messages: vscode.LanguageModelChatMessage[],
  provider: { id: string; currentModelId: string },
  response?: string
): Promise<void> {
  // Check if debug mode is enabled
  const config = vscode.workspace.getConfiguration('dotnetFlow');
  const debugEnabled = config.get<boolean>('debug.savePrompts', false);
  
  if (!debugEnabled) {
    return;
  }

  try {
    // Increment sequence for this prompt
    promptSequence++;
    
    // Get workspace folder or use a temp directory
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const baseDir = workspaceFolder?.uri.fsPath || process.cwd();
    
    // Create debug directory
    const debugDir = path.join(baseDir, '.debug', 'prompts');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    // Generate filename
    const filename = `prompt-${promptSequence}-${provider.id}.md`;
    const filePath = path.join(debugDir, filename);
    
    // Format messages for markdown
    const formattedMessages = messages.map(msg => {
      const role = msg.role === vscode.LanguageModelChatMessageRole.User ? 'User' : 'Assistant';
      const content = typeof msg.content === 'string' 
        ? msg.content 
        : msg.content.map(part => 'value' in part ? part.value : '').join('');
      
      return `### ${role}\n\n${content}`;
    }).join('\n\n');
    
    // Create markdown content
    const timestamp = new Date().toISOString();
    const responseSection = response 
      ? `## Response\n\n${response}`
      : `## Response\n\n*(Response not captured or request failed)*`;
    
    const markdownContent = `# Debug: LLM Request - ${provider.id} - Sequence ${promptSequence}

**Provider:** ${provider.id}  
**Model:** ${provider.currentModelId}  
**Timestamp:** ${timestamp}

## Request Messages

${formattedMessages}

${responseSection}
`;

    // Write to file
    fs.writeFileSync(filePath, markdownContent, 'utf8');
    
  } catch (error) {
    // Don't throw errors from debug logging - just log to console
    console.warn('Failed to save prompt debug info:', error);
  }
}