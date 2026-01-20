export interface LEDModule {
  id: string;
  sku: string;
  name: string;
  voltage: 12 | 24;
  powerWatts: number;
  colorTemp: string; // e.g. "7100K"
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  optical: {
    beamAngleX: number;
    beamAngleY: number;
    lumens: number;
  };
  installation: {
    minDepthInches: number; // Minimum can depth
    maxDepthInches: number;
    modulesPerFoot: number;
    maxRunLengthFt: number;
  };
}

export interface PowerSupply {
  sku: string;
  description: string;
  voltage: 12 | 24;
  maxWatts: number;
  class: 2; // Class 2 power supply
}

export interface Catalog {
  modules: LEDModule[];
  powerSupplies: PowerSupply[];
}
