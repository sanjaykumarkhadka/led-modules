import type { LEDModule } from '../../data/catalog/modules';
import type { PowerSupply } from '../../data/catalog/powerSupplies';

export interface BOMItem {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  category: 'Lighting' | 'Power' | 'Housing';
}

export function generateBOM(
  moduleType: LEDModule,
  totalModules: number,
  psu: PowerSupply | null
): BOMItem[] {
  const items: BOMItem[] = [];

  // 1. LED Modules
  items.push({
    sku: moduleType.id,
    name: moduleType.name,
    quantity: totalModules,
    unit: 'pcs',
    category: 'Lighting',
  });

  // 2. Power Supplies
  if (psu) {
    // Calculate how many PSUs we need
    // Logic should be in store, but here we assume 'psu' param implies 1 unit covers it?
    // Wait, store selected a "Recommended PSU" type, but we might need multiple.

    // Let's assume the store logic finds a SINGLE PSU type that fits,
    // or we need to calculate quantity here.
    // For simplicity: Simple 1-1 mapping for small signs, but robust logic:

    const totalWatts = totalModules * moduleType.wattsPerModule;
    // 80% loading
    const capacity = psu.maxWatts * 0.8;
    const qty = Math.ceil(totalWatts / capacity);

    items.push({
      sku: psu.id,
      name: psu.name,
      quantity: Math.max(1, qty),
      unit: 'pcs',
      category: 'Power',
    });
  }

  return items;
}
