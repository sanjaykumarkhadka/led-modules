# Complete Project Prompt: LED Channel Letter Configurator

Create a professional web-based LED Channel Letter Configurator application for Qwatt Technologies that allows users to design custom LED channel letters, visualize LED placement, and calculate manufacturing specifications.

---

## Project Overview

Build a single-page web application that:
1. Renders custom text as SVG channel letters using OpenType fonts
2. Intelligently places LED modules inside letter strokes
3. Calculates power requirements, LED counts, and engineering specifications
4. Provides interactive controls for customization
5. Generates PDF reports with specifications

---

## Technology Stack

- **HTML5** with semantic markup
- **Tailwind CSS** (via CDN) for styling
- **Vanilla JavaScript (ES6+)** - no frameworks
- **OpenType.js** for font rendering
- **jsPDF** for PDF generation
- **Font Awesome 6.4.0** for icons
- **SVG** for graphics rendering

---

## File Structure

```
project/
├── index.html          # Main application interface
├── main.js            # Core application logic
├── led-placement.js   # LED placement algorithms
├── ui-components.js   # UI component generation
├── data.js           # Configuration data
└── styles.css        # Custom styles and animations
```

---

## Detailed Requirements

### 1. HTML Structure (`index.html`)

Create a responsive single-page application with:

**Header Section:**
- Qwatt Technologies branding with blue lightning bolt icon
- Imperial/Metric unit toggle switch
- Language selector (English, Español, Français)

**Main Layout:**
- Left panel (configuration and canvas)
- Right panel (editor and controls)

**Left Panel Components:**
- Tabs: Channel Letter, Cabinet, Custom Artwork
- Action buttons: "Do it for me", "PDF", "Details"
- Configuration form with fields for:
  - Layout Type (Face Lit, Back Lit, Halo Lit)
  - Voltage (24V, 12V)
  - Power Supply selector
  - Font selector
  - Height (inches/cm)
  - Depth (inches/cm)
  - LED Module type
  - Module Pitch
- Text input field with "Populate" and "Clear" buttons
- Toolbar with transform controls (rotate, scale, move, LED count)
- SVG canvas with grid background
- Results panel (hidden initially)

**Right Panel Components:**
- LED Control Panel (color, brightness, effects)
- Editor Panel (stroke color, stroke width, LED color, LED count)
- Character Library (A-Z buttons)

**External Dependencies:**
```html
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<script src="https://cdn.jsdelivr.net/npm/opentype.js@latest/dist/opentype.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```

---

### 2. Configuration Data (`data.js`)

Create a `CONFIG_DATA` object containing:

**Character Data** (for 12-inch high letters):
- All uppercase letters (A-Z)
- All lowercase letters (a-z)
- Numbers (0-9)
- For each character:
  - `modulesPerSqFt`: LED density
  - `area`: Surface area in sq ft
  - `perimeter`: Outline length in feet

Example:
```javascript
'A': { modulesPerSqFt: 2.78, area: 2.5, perimeter: 7.6 }
```

**LED Modules:**
```javascript
modules: {
    "Tetra MAX 24V Small 71K": {
        wattsPerModule: 0.4,
        recommendedSpacingRatio: 1.8,
        modulesPerFoot: 3,
        size: 4
    },
    "Tetra MAX 24V Medium 71K": {
        wattsPerModule: 0.5,
        recommendedSpacingRatio: 2.2,
        modulesPerFoot: 2.5,
        size: 5
    },
    "Tetra MAX 24V Large 71K": {
        wattsPerModule: 0.7,
        recommendedSpacingRatio: 2.6,
        modulesPerFoot: 2,
        size: 6
    }
}
```

**Power Supplies:**
```javascript
powerSupplies: {
    "GEPS24LT-100U-NA": { maxWatts: 100, voltage: 24 },
    "GEPS12LT-100U-NA": { maxWatts: 100, voltage: 12 },
    "GEPS24LT-60U-NA": { maxWatts: 60, voltage: 24 }
}
```

**Default Settings:**
```javascript
defaults: {
    ledCount: 5,
    strokeColor: '#333333',
    strokeWidth: 2,
    ledColor: '#666666',
    ledBrightness: 100,
    fontSize: 150,
    letterSpacing: 20
}
```

---

### 3. UI Components (`ui-components.js`)

Create a `UIComponents` class that generates:

**Configuration Form:**
- Grid layout (3 columns on desktop)
- Select dropdowns for all configuration options
- Number inputs with unit displays
- Checkbox for Remote PS

**Toolbar:**
- Icon buttons for:
  - Rotate left/right
  - Move up/down
  - Scale up/down
  - Increase/decrease LEDs
  - Clear canvas

**Results Panel:**
- Display cards showing:
  - LED Modules Required
  - Total Stroke Length
  - Power Required (Watts)
  - Power Supplies Needed
  - Recommended Module Spacing
  - Circuit Run Length

**Editor Panel:**
- Stroke color picker with hex display
- Stroke width slider (1-10)
- LED color picker with hex display
- LED count input with +/- buttons

**LED Control Panel:**
- Individual LED color picker
- Brightness slider (0-100%)
- Effect dropdown (None, Blink, Pulse, Chase)
- "Apply to All" and "Apply to Character" buttons
- LED preview with glow effect

**Character Library:**
- 4-column grid of A-Z buttons
- Clickable cards to add characters to text input

---

### 4. LED Placement Algorithm (`led-placement.js`)

Create a `LEDPlacer` class with sophisticated placement logic:

**Main Method: `placeLEDsInside(pathElement, charGroup, ledCount, options)`**

Algorithm steps:
1. Get letter bounding box and stroke width
2. Calculate inward offset (12% of letter size, minimum 10px)
3. Generate candidate positions:
   - Sample path at multiple points
   - Calculate normal vectors pointing inward
   - Test multiple offset distances (50%, 70%, 90% of offset)
   - Keep only points inside the filled letter area
4. Select well-spaced LEDs using maximin algorithm:
   - Start with center-most point
   - Iteratively select points that maximize minimum distance to selected points
   - Ensure minimum spacing based on letter area
5. Create rectangular LED elements (12px size with 1.2:0.7 aspect ratio)

**Helper Methods:**
- `calculateNormal(pathElement, distance)`: Calculate perpendicular vector to path
- `isPointInside(pathElement, x, y)`: Check if point is inside letter using `isPointInFill`
- `selectWellSpacedPoints(candidates, count, minSpacing)`: Maximin point selection
- `createLEDElement(ledData, color, brightness, effect, index)`: Create SVG rect element

**LED Element Styling:**
- Gray rectangular modules (#888888)
- Slight border radius (2px)
- Stroke: #555, width: 1
- Opacity based on brightness
- Rotation aligned with path

---

### 5. Main Application Logic (`main.js`)

Create a `LEDConfigurator` class:

**Constructor & Initialization:**
```javascript
constructor() {
    this.font = null;
    this.ledPlacer = new LEDPlacer();
    this.uiComponents = new UIComponents();
    this.state = {
        rotation: 0,
        translateY: 0,
        scale: 1,
        isDragging: false,
        currentElement: null,
        dragOffsetX: 0,
        dragOffsetY: 0,
        selectedCharGroup: null,
        selectedLed: null,
        currentText: '',
        ledCountPerChar: {} // Store per-character LED counts
    };
    this.init();
}
```

**Font Loading:**
- Load Roboto Slab font from Google Fonts GitHub
- Show loading spinner during font load
- Implement fallback font with simple letter shapes
- Handle errors gracefully

**Text Rendering: `renderText()`**
1. Clear existing SVG content
2. Create SVG element with preserveAspectRatio
3. For each character:
   - Create character group with data-char attribute
   - Get path from font using OpenType.js
   - Create letter outline path (stroke only)
   - Create letter fill path (white fill, opacity 0)
   - Add to main group
4. Calculate viewBox to fit all letters
5. Add height measurement annotation on left side
6. Place LEDs in each character using LEDPlacer
7. Add LED count display below each character
8. Update total LED count
9. Calculate and display results

**Character Interaction:**
- Click to select character
- Show popup control panel for per-character LED count
- Position panel next to selected character
- Allow LED count adjustment (1-20)
- Update LED placement when count changes
- Recalculate totals and power requirements

**LED Count Control Panel:**
```javascript
showCharacterLEDControls(charGroup) {
    // Create floating panel with:
    // - Current character display
    // - LED count input with +/- buttons
    // - Apply button
    // - Close button
    // Position fixed next to character
    // Handle Escape key to close
}
```

**Transform Operations:**
- `rotate(angle)`: Rotate entire letter group
- `move(dx, dy)`: Translate vertically
- `zoom(factor)`: Scale up/down
- Update transform attribute on mainGroup

**Drag & Drop:**
- Click and drag individual characters
- Calculate SVG coordinates from mouse position
- Apply translate transform to character group

**Results Calculation: `calculateResults()`**
1. Get configuration values (module type, power supply, height)
2. Loop through each character:
   - Use per-character LED count if customized
   - Otherwise use default LED count
   - Sum total LED modules
   - Calculate perimeter based on character data and height
3. Calculate:
   - Total stroke length (with unit conversion)
   - Power required (modules × watts per module)
   - Power supplies needed (ceiling of required/max watts)
   - Recommended spacing (perimeter / LED count)
   - Circuit length (perimeter × 1.2 safety factor)
4. Update results panel displays

**PDF Generation: `generatePDF()`**
1. Create jsPDF instance (landscape A4)
2. Add header: "Qwatt Technologies"
3. Add date/time stamp
4. Convert SVG to canvas then to PNG
5. Add image to PDF
6. Create specifications table:
   - Text content
   - Letter height
   - Total LED modules
   - Power required
   - Power supplies needed
   - Per-character LED counts
7. Save with filename: "Channel Letter MM-DD-YYYY HH MM.pdf"

**Event Listeners:**
- Populate button → renderText()
- Clear button → clearCanvas()
- Text input Enter key → renderText()
- PDF button → generatePDF()
- Unit toggle → updateUnits()
- Toolbar buttons → transform methods
- Character click → selectCharacter()
- LED click → selectLED()
- Editor controls → update styles in real-time

---

### 6. Custom Styles (`styles.css`)

**Letter Styles:**
```css
.letter-outline {
    cursor: pointer;
    transition: all 0.2s ease;
}
.letter-outline:hover {
    stroke: #3b82f6 !important;
    stroke-width: 3 !important;
}
.letter-outline.selected {
    stroke: #ef4444 !important;
    stroke-width: 4 !important;
    filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.5));
}
```

**LED Styles:**
```css
.led-strip {
    fill: #666666;
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0.9;
}
.led-strip:hover {
    transform: scale(1.3);
    fill: #3b82f6;
}
```

**Canvas:**
```css
.canvas-container {
    background-image:
        linear-gradient(#e5e7eb 1px, transparent 1px),
        linear-gradient(90deg, #e5e7eb 1px, transparent 1px);
    background-size: 20px 20px;
    min-height: 400px;
}
```

**Loading Spinner:**
```css
#loader {
    border: 5px solid #f3f3f3;
    border-top: 5px solid #3498db;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
```

**LED Effects:**
```css
@keyframes blink {
    0%, 50%, 100% { opacity: 1; }
    25%, 75% { opacity: 0.3; }
}
@keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.9); }
}
@keyframes chase {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
}
.led-effect-blink { animation: blink 1s infinite; }
.led-effect-pulse { animation: pulse 2s infinite; }
.led-effect-chase { animation: chase 1s infinite; }
```

**Tab Indicators:**
```css
.tab-indicator {
    transition: all 0.3s ease;
    transform: scaleX(0);
}
.tab-active .tab-indicator {
    transform: scaleX(1) !important;
}
```

**Character Control Panel:**
```css
.character-led-control-panel {
    display: none;
    font-family: 'Inter', sans-serif;
    position: fixed;
    z-index: 1000;
}
```

---

## Key Features & Functionality

### 1. Per-Character LED Customization
- Click any letter to open control panel
- Adjust LED count for that specific letter (1-20)
- LEDs are removed and regenerated with new count
- Total LED count and power calculations update automatically
- LED count displayed below each character

### 2. Height Measurement Display
- Vertical measurement line on left side of letters
- Shows height value from configuration (e.g., "35.0"")
- Includes top and bottom tick marks

### 3. LED Count Tracking
- Global default LED count in editor panel
- Per-character override stored in `state.ledCountPerChar`
- Display count below each character
- Update calculations using per-character counts

### 4. Unit Conversion
- Toggle between Imperial (inches) and Metric (cm)
- Automatically convert all displayed measurements
- Update height, depth, spacing, circuit length units

### 5. Real-time Calculations
When LED count changes:
- Recalculate total LED modules
- Update power required (modules × watts per module)
- Recalculate power supplies needed
- Update recommended spacing
- Update circuit run length

### 6. Interactive Controls
- Drag individual characters to reposition
- Select characters for editing
- Click LEDs for individual color/brightness control
- Apply settings to all LEDs or single character
- Transform entire composition (rotate, scale, move)

---

## Calculation Formulas

**Total LED Modules:**
```javascript
totalModules = sum(ledCountPerChar[char] for each char in text)
```

**Total Perimeter:**
```javascript
letterHeightFeet = heightInches / 12
totalPerimeter = sum(characterData[char].perimeter × letterHeightFeet)
```

**Power Required:**
```javascript
powerRequired = totalModules × moduleWattsPerModule
```

**Power Supplies Needed:**
```javascript
powerSuppliesNeeded = ceil(powerRequired / powerSupplyMaxWatts)
```

**Recommended Spacing:**
```javascript
avgSpacing = (totalPerimeter × 12) / totalModules  // in inches
```

**Circuit Length:**
```javascript
circuitLength = totalPerimeter × 12 × 1.2  // 20% safety margin
```

---

## Implementation Guidelines

### Code Organization
- Use ES6 classes for modularity
- Export classes to window object for cross-file access
- Use descriptive variable and function names
- Add comments for complex algorithms
- Keep functions focused and single-purpose

### Error Handling
- Validate user inputs (LED count 1-20, positive dimensions)
- Check for null/undefined before DOM operations
- Provide fallback font if external load fails
- Handle missing jsPDF library gracefully

### Performance
- Use event delegation where appropriate
- Debounce expensive calculations
- Reuse SVG elements when possible
- Minimize DOM reflows

### User Experience
- Show loading spinner during font load
- Provide immediate visual feedback on interactions
- Smooth transitions and animations
- Clear error messages
- Responsive layout for different screen sizes

### Browser Compatibility
- Use standard SVG methods
- Avoid experimental CSS features
- Test in Chrome, Firefox, Safari, Edge
- Provide fallbacks for older browsers

---

## Testing Checklist

- [ ] Font loads successfully from CDN
- [ ] Fallback font works when CDN fails
- [ ] Text renders correctly with all characters
- [ ] LEDs place inside letter strokes properly
- [ ] LED count adjusts per character
- [ ] Calculations update when LED count changes
- [ ] Total LED count is accurate
- [ ] Power calculations are correct
- [ ] PDF generation works
- [ ] Unit conversion toggles correctly
- [ ] Character selection and highlighting works
- [ ] Drag and drop repositioning functions
- [ ] Transform controls work (rotate, scale, move)
- [ ] LED effects animate correctly
- [ ] Results panel displays all values
- [ ] Responsive layout works on mobile
- [ ] All buttons have proper event handlers
- [ ] No console errors

---

## Sample Character Data

Provide complete character data for all letters and numbers. Example entries:

```javascript
characterData: {
    'A': { modulesPerSqFt: 2.78, area: 2.5, perimeter: 7.6 },
    'B': { modulesPerSqFt: 2.74, area: 3.3, perimeter: 7.4 },
    'C': { modulesPerSqFt: 2.63, area: 2.3, perimeter: 9.5 },
    // ... all A-Z, a-z, 0-9
    '0': { modulesPerSqFt: 2.66, area: 2.6, perimeter: 5.8 },
    ' ': { modulesPerSqFt: 0, area: 0, perimeter: 0 }
}
```

---

## Branding

- **Company**: Qwatt Technologies
- **Logo**: Blue circular background with white lightning bolt icon
- **Primary Color**: Blue (#3b82f6)
- **Secondary Color**: Gray (#6b7280)
- **Font**: Inter (via Google Fonts)

---

## Final Notes

This application should be:
- ✅ Production-ready with clean, maintainable code
- ✅ Fully functional with no placeholder features
- ✅ Responsive and mobile-friendly
- ✅ Well-documented with inline comments
- ✅ Performant with smooth animations
- ✅ Professional appearance matching the provided design
- ✅ Accessible with proper ARIA labels and keyboard navigation

The end result should be a professional tool that sign manufacturers can use to design LED channel letters, visualize LED placement, and generate accurate specifications for production.
