export { registerBlock, getBlock, getAllBlocks, getBlocksByCategory, getCategories } from './registry';
import { registerNavigationBlocks } from './navigation';
import { registerInteractionBlocks } from './interaction';
import { registerAssertionBlocks } from './assertion';
import { registerApiBlocks } from './api';
import { registerLogicBlocks } from './logic';
import { registerDataBlocks } from './data';

// Register all built-in blocks
export function registerAllBlocks(): void {
  registerNavigationBlocks();
  registerInteractionBlocks();
  registerAssertionBlocks();
  registerApiBlocks();
  registerLogicBlocks();
  registerDataBlocks();
}
