# Qwatt LED Configurator (v2)

Enterprise-grade LED Channel Letter Configurator, rebuilt with **React**, **TypeScript**, and **Vite**.

## 🚀 Getting Started

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:5174](http://localhost:5174) (or the port shown in terminal).

## 🏗 Architecture

-   **Frontend**: React 19 + TypeScript
-   **Styling**: Tailwind CSS v4
-   **Canvas Engine**: SVG + React (src/components/canvas)
-   **Math Core**: Pure TypeScript logic (src/core/math)

## 📦 Features (Implemented)

-   **Product Catalog**: Includes *Tetra® Atom*, *MS*, and *MAX* definitions.
-   **Smart Constraints**: Automatically selects the correct LED module based on can depth.
-   **Layout Engine**: "Walk and Place" algorithm for even LED distribution.
-   **Canvas Stage**: Dynamic font loading and real-time rendering.

## 📁 Project Structure

```
src/
├── components/         # React Components
│   └── canvas/         # SVG/Canvas Rendering Logic
├── core/               # Business Logic (No React dependencies)
│   └── math/           # Geometry & Placement Algorithms
├── data/               # Static Data Declarations
│   └── catalog/        # LED Products & Power Supplies
└── App.tsx             # Main Controller
```

---
*Legacy Prototype backup located in `/legacy_prototype`*
