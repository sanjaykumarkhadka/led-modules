export interface LEDModule {
  id: string;
  name: string;
  voltage: 12 | 24;
  wattsPerModule: number;
  lumensPerModule: number;
  colorTemperature: string; // e.g. "7100K"
  dimensions: {
    width: number; // mm
    height: number; // mm
    length: number; // mm
  };
  installation: {
    modulesPerFoot: number;
    maxRunLength?: number; // modules
  };
}

export const MODULE_CATALOG: LEDModule[] = [
  {
    id: 'tetra-max-mini-24v',
    name: 'Tetra MAX 24V Mini',
    voltage: 24,
    wattsPerModule: 0.31,
    lumensPerModule: 50,
    colorTemperature: '7100K',
    dimensions: { length: 50, width: 14, height: 10 }, // estimated
    installation: {
      modulesPerFoot: 4,
      maxRunLength: 300,
    },
  },
  {
    id: 'tetra-max-small-24v',
    name: 'Tetra MAX 24V Small',
    voltage: 24,
    wattsPerModule: 0.4,
    lumensPerModule: 65,
    colorTemperature: '7100K',
    dimensions: { length: 60, width: 15, height: 11 },
    installation: {
      modulesPerFoot: 3,
      maxRunLength: 240,
    },
  },
  {
    id: 'tetra-max-medium-24v',
    name: 'Tetra MAX 24V Medium',
    voltage: 24,
    wattsPerModule: 0.5,
    lumensPerModule: 82,
    colorTemperature: '7100K',
    dimensions: { length: 70, width: 17, height: 12 },
    installation: {
      modulesPerFoot: 2.5,
      maxRunLength: 190,
    },
  },
  {
    id: 'tetra-max-large-24v',
    name: 'Tetra MAX 24V Large',
    voltage: 24,
    wattsPerModule: 0.7,
    lumensPerModule: 115,
    colorTemperature: '7100K',
    dimensions: { length: 85, width: 19, height: 13 },
    installation: {
      modulesPerFoot: 2,
      maxRunLength: 140,
    },
  },
];
