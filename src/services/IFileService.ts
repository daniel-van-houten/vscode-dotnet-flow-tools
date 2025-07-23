import * as vscode from 'vscode';

/**
 * Service for file system operations
 */
export interface IFileService {
  /**
   * Find files matching a pattern in the workspace
   * @param pattern Glob pattern to search for
   * @param exclude Optional exclude pattern
   * @param maxResults Maximum number of results
   */
  findFiles(pattern: string, exclude?: string, maxResults?: number): Promise<vscode.Uri[]>;
  
  /**
   * Write content to a file
   * @param uri File URI
   * @param content Content to write
   */
  writeFile(uri: vscode.Uri, content: string): Promise<void>;
  
  /**
   * Open a text document
   * @param uri File URI
   */
  openTextDocument(uri: vscode.Uri): Promise<vscode.TextDocument>;
  
  /**
   * Create a file URI relative to workspace
   * @param relativePath Path relative to workspace root
   */
  createWorkspaceUri(relativePath: string): vscode.Uri;
}