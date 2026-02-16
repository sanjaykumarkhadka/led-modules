import type { LEDModule } from '../../data/catalog/modules';

export interface PowerAnalysis {
  totalWatts: number;
  totalAmps: number;
  modulesPerCircuit: number; // Max modules before voltage drop warning
}

export function calculatePowerLoad(moduleCount: number, moduleType: LEDModule): PowerAnalysis {
  const totalWatts = moduleCount * moduleType.wattsPerModule;
  // Amps = Watts / Volts
  const totalAmps = totalWatts / moduleType.voltage;

  // Safe run length hardcoded for now, ideally comes from catalog
  // Typically 60W limit on 24V class 2 circuit => 2.5A
  const modulesPerCircuit = moduleType.installation.maxRunLength || 100;

  return {
    totalWatts,
    totalAmps,
    modulesPerCircuit,
  };
}
