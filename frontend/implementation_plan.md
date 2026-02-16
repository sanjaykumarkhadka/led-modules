# Phase 2 Implementation Plan: LED Configurator (React Migration)

This plan outlines the steps to upgrade the current "Phase 1.5" prototype into a fully functional production-grade application, matching the capabilities of the legacy specification.

## 1. Advanced LED Placement Engine
The current "Walk and Place" algorithm is too simple. We need to implement the sophisticated logic from the legacy design.
- [ ] **Dynamic Stroke Analysis**: Calculate actual stroke width at any point to determine optimal LED offset (replacing hardcoded 15px).
- [ ] **Maximin Distribution**: Implement the "Maximin" algorithm to optimize LED spacing and prevent bunching.
- [ ] **Multi-row Support**: Automatically switch to double-rows of LEDs for thick strokes (wide fonts/large depth).
- [ ] **Corner Handling**: specific logic to ensure LEDs are placed correctly in sharp corners.

## 2. Interactive Canvas & Editor
Move from a static SVG render to a fully interactive design surface.
- [ ] **Per-Character Rendering**: Split the text string into individual glyph paths that can be manipulated independently.
- [ ] **Selection Model**: Click to select individual letters or LED groups.
- [ ] **Drag & Transform**: Implement drag-to-move, rotate, and scale for individual characters.
- [ ] **Manual Overrides**: UI to manually +/- LED count for a selected letter.

## 3. Data & Catalog Integration
Replace hardcoded values with a scalable data layer.
- [ ] **Module Catalog**: Populate `src/data/catalog/modules.ts` with complete Tetra MAX dataset (Mini, Small, Medium, Large).
- [ ] **Power Supplies**: Create `src/data/catalog/powerSupplies.ts` and implement logic to recommend PSUs based on load.
- [ ] **Project Settings**: Global store (likely Zustand or Context) for project-wide settings (Units, Voltage, Target Brightness).

## 4. Engineering Calculations
Implement the physics/math layer for the "Results" panel.
- [ ] **Power Analysis**: Calculate total wattage and amps based on module count.
- [ ] **Constraint Checking**: Warn if run lengths exceed safe limits for the selected wire gauge/voltage.
- [ ] **BOM Generation**: Generate a Bill of Materials object ready for PDF export.

## 5. UI/UX Polish
- [ ] **Properties Panel**: Context-aware right sidebar (shows Letter props when Letter selected, Global props otherwise).
- [ ] **Visual Feedback**: Hover states, selection outlines, and "snapping" guides.
- [ ] **Asset Loading**: Robust font loading with fallbacks and loading states.
