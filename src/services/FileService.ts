import * as vscode from 'vscode';
import { IFileService } from './IFileService';
import { ResourceNotFoundError } from '../core/ErrorTypes';

/**
 * Implementation of file service using VS Code APIs
 */
export class FileService implements IFileService {
  async findFiles(pattern: string, exclude?: string, maxResults?: number): Promise<vscode.Uri[]> {
    return vscode.workspace.findFiles(pattern, exclude, maxResults);
  }

  async writeFile(uri: vscode.Uri, content: string): Promise<void> {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
  }

  async openTextDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
    return vscode.workspace.openTextDocument(uri);
  }

  createWorkspaceUri(relativePath: string): vscode.Uri {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      throw new ResourceNotFoundError('No workspace folder found', 'workspace');
    }
    
    return vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, relativePath);
  }
}