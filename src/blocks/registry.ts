import { BlockDefinition, BlockCategory } from '../schema';

// ─── Block Registry ──────────────────────────────────────────────────────────
// Simple map. No classes. Just objects with execute functions.

const registry = new Map<string, BlockDefinition>();

export function registerBlock(block: BlockDefinition): void {
  registry.set(block.type, block);
}

export function getBlock(type: string): BlockDefinition | undefined {
  return registry.get(type);
}

export function getAllBlocks(): BlockDefinition[] {
  return Array.from(registry.values());
}

export function getBlocksByCategory(category: BlockCategory): BlockDefinition[] {
  return getAllBlocks().filter(b => b.category === category);
}

export function getCategories(): BlockCategory[] {
  return ['navigation', 'interaction', 'assertion', 'api', 'logic', 'data'];
}
