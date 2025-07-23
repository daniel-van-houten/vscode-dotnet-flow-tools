import * as vscode from 'vscode';

export interface ProcessingContext {
  traceContent: string;
  className: string;
  methodName: string;
  businessContext?: string;
  cancellationToken?: vscode.CancellationToken;
  progressCallback?: (message: string, increment?: number) => void;
}

export interface ProcessingResult {
  content: string;
  approach: 'single-shot' | 'chunked';
  chunkCount: number;
}

export interface AnalysisResult {
  approach: 'single-shot' | 'chunked';
  estimatedTokens: number;
  maxTokens: number;
  chunkCount?: number;
  recommendation: string;
}

export interface CodeSection {
  marker: string;
  file: string;
  class?: string;
  method: string;
  content: string;
}

export interface ParsedTrace {
  callGraph: string;
  codeSections: CodeSection[];
}

export interface ChunkInfo {
  content: string;
  sections: CodeSection[];
}