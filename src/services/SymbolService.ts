import * as vscode from 'vscode';
import { ISymbolService, MethodSymbolInfo } from './ISymbolService';

/**
 * Implementation of symbol service using VS Code APIs
 */
export class SymbolService implements ISymbolService {
  async findMethodAtPosition(document: vscode.TextDocument, position: vscode.Position): Promise<MethodSymbolInfo | null> {
    const symbols = await this.getDocumentSymbols(document);
    
    const method = this.findSymbol(symbols, s => 
      s.kind === vscode.SymbolKind.Method && s.range.contains(position)
    );
    
    if (!method) {
      return null;
    }
    
    const cls = this.findSymbol(symbols, s => 
      s.kind === vscode.SymbolKind.Class && s.range.contains(method.range)
    );
    
    if (!cls) {
      return null;
    }
    
    return { method, class: cls };
  }

  async getDocumentSymbols(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider', 
      document.uri
    );
    
    return symbols || [];
  }

  private findSymbol(
    symbols: vscode.DocumentSymbol[],
    predicate: (s: vscode.DocumentSymbol) => boolean
  ): vscode.DocumentSymbol | undefined {
    for (const symbol of symbols) {
      if (predicate(symbol)) {
        return symbol;
      }
      
      const child = this.findSymbol(symbol.children, predicate);
      if (child) {
        return child;
      }
    }
    
    return undefined;
  }
}