// data.js - Configuration data for LED calculations and modules

const CONFIG_DATA = {
  // Character data for calculations (Area and Perimeter are for a 12-inch high letter)
  characterData: {
    a: { modulesPerSqFt: 3.06, area: 2, perimeter: 7.3 },
    b: { modulesPerSqFt: 2.6, area: 2.7, perimeter: 7.5 },
    c: { modulesPerSqFt: 2.68, area: 1.5, perimeter: 6.9 },
    d: { modulesPerSqFt: 2.6, area: 2.7, perimeter: 7.5 },
    e: { modulesPerSqFt: 3.16, area: 1.9, perimeter: 7.0 },
    f: { modulesPerSqFt: 2.01, area: 1.5, perimeter: 6.9 },
    g: { modulesPerSqFt: 3.08, area: 2.9, perimeter: 9.2 },
    h: { modulesPerSqFt: 2.69, area: 2.2, perimeter: 9.7 },
    i: { modulesPerSqFt: 3.41, area: 0.9, perimeter: 4.3 },
    j: { modulesPerSqFt: 3.1, area: 1.3, perimeter: 5.8 },
    k: { modulesPerSqFt: 2.76, area: 2.2, perimeter: 9.6 },
    l: { modulesPerSqFt: 2.42, area: 1.2, perimeter: 5.6 },
    m: { modulesPerSqFt: 2.76, area: 2.9, perimeter: 12.7 },
    n: { modulesPerSqFt: 2.6, area: 1.9, perimeter: 8.6 },
    o: { modulesPerSqFt: 2.65, area: 2.3, perimeter: 5.3 },
    p: { modulesPerSqFt: 2.57, area: 2.7, perimeter: 7.6 },
    q: { modulesPerSqFt: 2.55, area: 2.7, perimeter: 7.7 },
    r: { modulesPerSqFt: 2.68, area: 1.1, perimeter: 5.5 },
    s: { modulesPerSqFt: 3.14, area: 1.6, perimeter: 7.8 },
    t: { modulesPerSqFt: 2.19, area: 1.4, perimeter: 6.3 },
    u: { modulesPerSqFt: 2.6, area: 1.9, perimeter: 8.6 },
    v: { modulesPerSqFt: 2.47, area: 1.6, perimeter: 7.5 },
    w: { modulesPerSqFt: 2.95, area: 2.7, perimeter: 12.7 },
    x: { modulesPerSqFt: 2.31, area: 1.7, perimeter: 8.3 },
    y: { modulesPerSqFt: 2.96, area: 2, perimeter: 8.9 },
    z: { modulesPerSqFt: 3.03, area: 1.6, perimeter: 7.6 },
    A: { modulesPerSqFt: 2.78, area: 2.5, perimeter: 7.6 },
    B: { modulesPerSqFt: 2.74, area: 3.3, perimeter: 7.4 },
    C: { modulesPerSqFt: 2.63, area: 2.3, perimeter: 9.5 },
    D: { modulesPerSqFt: 2.31, area: 3.5, perimeter: 7.0 },
    E: { modulesPerSqFt: 2.82, area: 2.5, perimeter: 10.7 },
    F: { modulesPerSqFt: 2.45, area: 2, perimeter: 8.8 },
    G: { modulesPerSqFt: 2.91, area: 2.8, perimeter: 11.7 },
    H: { modulesPerSqFt: 2.6, area: 2.7, perimeter: 10.6 },
    I: { modulesPerSqFt: 2.56, area: 1.2, perimeter: 5.2 },
    J: { modulesPerSqFt: 2.53, area: 1.6, perimeter: 6.7 },
    K: { modulesPerSqFt: 3.16, area: 2.5, perimeter: 10.7 },
    L: { modulesPerSqFt: 2.53, area: 1.6, perimeter: 6.8 },
    M: { modulesPerSqFt: 2.66, area: 3.8, perimeter: 15.7 },
    N: { modulesPerSqFt: 2.39, area: 2.9, perimeter: 12.0 },
    O: { modulesPerSqFt: 2.22, area: 3.6, perimeter: 6.7 },
    P: { modulesPerSqFt: 2.58, area: 2.7, perimeter: 7.0 },
    Q: { modulesPerSqFt: 2.17, area: 3.7, perimeter: 7.3 },
    R: { modulesPerSqFt: 2.94, area: 3.1, perimeter: 8.8 },
    S: { modulesPerSqFt: 3, area: 2.3, perimeter: 10.1 },
    T: { modulesPerSqFt: 2.31, area: 1.7, perimeter: 7.5 },
    U: { modulesPerSqFt: 2.41, area: 2.5, perimeter: 9.9 },
    V: { modulesPerSqFt: 2.7, area: 2.2, perimeter: 9.3 },
    W: { modulesPerSqFt: 2.62, area: 3.8, perimeter: 16.1 },
    X: { modulesPerSqFt: 2.13, area: 2.4, perimeter: 10.1 },
    Y: { modulesPerSqFt: 2.22, area: 1.8, perimeter: 7.9 },
    Z: { modulesPerSqFt: 2.55, area: 2.3, perimeter: 9.9 },
    0: { modulesPerSqFt: 2.66, area: 2.6, perimeter: 5.8 },
    1: { modulesPerSqFt: 3.41, area: 1.8, perimeter: 8.1 },
    2: { modulesPerSqFt: 3, area: 2, perimeter: 8.9 },
    3: { modulesPerSqFt: 3.12, area: 1.9, perimeter: 9.4 },
    4: { modulesPerSqFt: 2.86, area: 2.1, perimeter: 6.7 },
    5: { modulesPerSqFt: 2.82, area: 2.1, perimeter: 10.0 },
    6: { modulesPerSqFt: 2.94, area: 2.4, perimeter: 7.8 },
    7: { modulesPerSqFt: 2.68, area: 1.5, perimeter: 7.2 },
    8: { modulesPerSqFt: 3.03, area: 2.6, perimeter: 6.8 },
    9: { modulesPerSqFt: 2.94, area: 2.4, perimeter: 7.8 },
    ' ': { modulesPerSqFt: 0, area: 0, perimeter: 0 },
  },

  // LED Module specifications
  modules: {
    'Tetra MAX 24V Small 71K': {
      wattsPerModule: 0.4,
      recommendedSpacingRatio: 1.8,
      modulesPerFoot: 3,
      size: 4,
    },
    'Tetra MAX 24V Medium 71K': {
      wattsPerModule: 0.5,
      recommendedSpacingRatio: 2.2,
      modulesPerFoot: 2.5,
      size: 5,
    },
    'Tetra MAX 24V Large 71K': {
      wattsPerModule: 0.7,
      recommendedSpacingRatio: 2.6,
      modulesPerFoot: 2,
      size: 6,
    },
  },

  // Power Supply specifications
  powerSupplies: {
    'GEPS24LT-100U-NA': { maxWatts: 100, voltage: 24 },
    'GEPS12LT-100U-NA': { maxWatts: 100, voltage: 12 },
    'GEPS24LT-60U-NA': { maxWatts: 60, voltage: 24 },
  },

  // Default settings
  defaults: {
    ledCount: 5,
    strokeColor: '#333333',
    strokeWidth: 2,
    ledColor: '#666666',
    ledBrightness: 100,
    fontSize: 150,
    letterSpacing: 20,
    lineSpacing: 50, // Spacing between lines in pixels
  },
};

// Export for use in other modules
window.CONFIG_DATA = CONFIG_DATA;
