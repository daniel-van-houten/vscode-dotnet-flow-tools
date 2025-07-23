import * as vscode from 'vscode';

/**
 * Symbol information for method analysis
 */
export interface MethodSymbolInfo {
  /**
   * Method symbol
   */
  method: vscode.DocumentSymbol;
  
  /**
   * Class symbol containing the method
   */
  class: vscode.DocumentSymbol;
}

/**
 * Service for working with VS Code document symbols
 */
export interface ISymbolService {
  /**
   * Find method and class symbols at a given position
   * @param document Document to analyze
   * @param position Position in the document
   */
  findMethodAtPosition(document: vscode.TextDocument, position: vscode.Position): Promise<MethodSymbolInfo | null>;
  
  /**
   * Get all document symbols
   * @param document Document to analyze
   */
  getDocumentSymbols(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[]>;
}