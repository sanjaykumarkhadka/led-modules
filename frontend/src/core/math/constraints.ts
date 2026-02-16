import { productCatalog } from '../../data/catalog/products';
import type { LEDModule } from '../../data/catalog/types';

/**
 * constraints.ts
 * Logic to select the appropriate LED module based on constraints (letters depth, etc.)
 */

export function recommendModuleForDepth(depthInches: number): LEDModule {
  // 1. Filter modules that support this depth
  const validModules = productCatalog.modules.filter(
    (m) =>
      depthInches >= m.installation.minDepthInches && depthInches <= m.installation.maxDepthInches
  );

  if (validModules.length === 0) {
    // Fallback or closest match logic could go here.
    // For now, return the smallest module if depth acts weird, or largest if too deep.
    if (depthInches < 1.0) return productCatalog.modules.find((m) => m.id === 'tetra-atom-24v')!;
    return productCatalog.modules[productCatalog.modules.length - 1];
  }

  // 2. Select the "best" module.
  // Heuristic: Use the largest module that fits (usually cheaper/efficient)
  // UNLESS depth is very shallow, then we prefer the dedicated shallow one.

  // Tetra Hub Logic approximation:
  // < 2" -> Atom
  // 2" - 3" -> MS
  // > 4" -> MAX

  if (depthInches < 2.0) {
    const atom = validModules.find((m) => m.id.includes('atom'));
    if (atom) return atom;
  }

  if (depthInches >= 4.0) {
    const max = validModules.find((m) => m.id.includes('max'));
    if (max) return max;
  }

  // Default to MS (mid-range) if available, else first valid
  const ms = validModules.find((m) => m.id.includes('ms'));
  return ms || validModules[0];
}
