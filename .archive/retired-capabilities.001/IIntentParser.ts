/**
 * @intent
 * Intent annotation extraction service interface
 */

import { Intent } from '../entities/Intent';

export interface IIntentParser {
  extractIntent(filePath: string): Promise<Intent | null>;
  extractIntentsFromDirectory(
    dirPath: string,
    recursive?: boolean,
    extensions?: string[]
  ): Promise<Intent[]>;
}
