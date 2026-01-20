export interface PowerSupply {
  id: string;
  name: string;
  voltage: 12 | 24;
  maxWatts: number;
  inputVoltage: string; // e.g. "120-277V"
  waterproof: boolean;
}

export const PSU_CATALOG: PowerSupply[] = [
  {
    id: 'geps-24-20',
    name: 'GEPS 24V 20W',
    voltage: 24,
    maxWatts: 20,
    inputVoltage: '90-264V',
    waterproof: true,
  },
  {
    id: 'geps-24-60',
    name: 'GEPS 24V 60W',
    voltage: 24,
    maxWatts: 60,
    inputVoltage: '90-264V',
    waterproof: true,
  },
  {
    id: 'geps-24-100',
    name: 'GEPS 24V 100W',
    voltage: 24,
    maxWatts: 100,
    inputVoltage: '108-305V',
    waterproof: true,
  },
  {
    id: 'geps-24-180',
    name: 'GEPS 24V 180W',
    voltage: 24,
    maxWatts: 180,
    inputVoltage: '108-305V',
    waterproof: true,
  },
  {
    id: 'geps-24-300',
    name: 'GEPS 24V 300W',
    voltage: 24,
    maxWatts: 300,
    inputVoltage: '108-305V',
    waterproof: true,
  },
];
