import type { Catalog } from './types';

export const productCatalog: Catalog = {
  modules: [
    {
      id: 'tetra-atom-24v',
      sku: 'GEDS71AT24',
      name: 'Tetra® Atom 24V',
      voltage: 24,
      powerWatts: 0.29, // Specific for Atom
      colorTemp: '7100K',
      dimensions: {
        length: 1.1,
        width: 0.4,
        height: 0.3,
      },
      optical: {
        beamAngleX: 165,
        beamAngleY: 140, // OptiLens X
        lumens: 28,
      },
      installation: {
        minDepthInches: 1.0,
        maxDepthInches: 2.5,
        modulesPerFoot: 4.0, // Tighter pitch for small letters
        maxRunLengthFt: 85,
      },
    },
    {
      id: 'tetra-ms-24v',
      sku: 'GEDS71MS24',
      name: 'Tetra® MS 24V',
      voltage: 24,
      powerWatts: 0.41,
      colorTemp: '7100K',
      dimensions: {
        length: 1.8,
        width: 0.5,
        height: 0.4,
      },
      optical: {
        beamAngleX: 165,
        beamAngleY: 140,
        lumens: 45,
      },
      installation: {
        minDepthInches: 1.5,
        maxDepthInches: 4.0,
        modulesPerFoot: 2.5,
        maxRunLengthFt: 60,
      },
    },
    {
      id: 'tetra-max-24v',
      sku: 'GEDS71MX24',
      name: 'Tetra® MAX 24V',
      voltage: 24,
      powerWatts: 0.7,
      colorTemp: '7100K',
      dimensions: {
        length: 2.5,
        width: 0.7,
        height: 0.5,
      },
      optical: {
        beamAngleX: 165,
        beamAngleY: 140,
        lumens: 105,
      },
      installation: {
        minDepthInches: 4.0,
        maxDepthInches: 8.0,
        modulesPerFoot: 1.5, // Wider pitch for large letters
        maxRunLengthFt: 40,
      },
    },
  ],
  powerSupplies: [
    {
      sku: 'GEPS24LT-100U-NA',
      description: 'Tetra 24V 100W Power Supply',
      voltage: 24,
      maxWatts: 100,
      class: 2,
    },
    {
      sku: 'GEPS24LT-60U-NA',
      description: 'Tetra 24V 60W Power Supply',
      voltage: 24,
      maxWatts: 60,
      class: 2,
    },
  ],
};
