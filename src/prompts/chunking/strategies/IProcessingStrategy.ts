import { ProcessingContext } from '../types';
import { IModelProvider } from '../../../providers/IModelProvider';

export interface IProcessingStrategy {
  canHandle(tokenCount: number, maxTokens: number): Promise<boolean>;
  process(context: ProcessingContext, provider: IModelProvider): Promise<string>;
  getApproachName(): 'single-shot' | 'chunked';
}