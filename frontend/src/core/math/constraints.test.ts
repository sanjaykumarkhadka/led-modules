import { describe, it, expect } from 'vitest';
import { recommendModuleForDepth } from './constraints';

describe('Constraint Logic', () => {
  it('should recommend Tetra Atom for shallow depths (1.5")', () => {
    const module = recommendModuleForDepth(1.5);
    expect(module.id).toContain('atom');
  });

  it('should recommend Tetra MS for medium depths (3")', () => {
    const module = recommendModuleForDepth(3.0);
    expect(module.id).toContain('ms');
  });

  it('should recommend Tetra MAX for deep cans (6")', () => {
    const module = recommendModuleForDepth(6.0);
    expect(module.id).toContain('max');
  });

  it('should fallback gracefully for extreme depths (0.5")', () => {
    // Less than 1 inch is tricky, should probably default to Atom (smallest)
    const module = recommendModuleForDepth(0.5);
    expect(module.id).toContain('atom');
  });
});
