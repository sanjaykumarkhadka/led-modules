# LED Channel Letter Configurator
//using html, css and javascript

A comprehensive web-based tool for designing and calculating LED channel letters for signage applications. This application allows users to create custom LED channel letters, visualize LED placement, and calculate all necessary specifications for manufacturing and installation.

## Features

### 🎨 **Visual Design Tools**
- Interactive SVG-based letter rendering using OpenType fonts
- Real-time LED placement visualization inside letter strokes
- Drag-and-drop character positioning
- Rotation, scaling, and positioning controls
- Character selection and individual editing

### 💡 **LED Configuration**
- Intelligent LED placement algorithm for inner stroke positioning
- Individual LED color and brightness control
- LED effects (blink, pulse, chase)
- Real-time LED count adjustment per character
- Visual LED preview with glow effects

### 📊 **Engineering Calculations**
- Automatic calculation of required LED modules
- Total stroke length measurement
- Power consumption analysis
- Power supply requirements
- Recommended module spacing
- Circuit run length estimation

### 🔧 **Technical Specifications**
- Support for multiple LED module types (Tetra MAX series)
- Various power supply options
- Imperial/Metric unit conversion
- Configurable letter dimensions and depths
- Module pitch customization

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **Icons**: Font Awesome 6.4.0
- **Typography**: OpenType.js for font rendering
- **Graphics**: SVG with native DOM manipulation

## Project Structure

```
├── index.html          # Main application interface
├── main.js            # Core application logic and event handling
├── led-placement.js   # LED placement algorithms
├── ui-components.js   # UI component generation
├── data.js           # Configuration data and character specifications
├── styles.css        # Custom CSS styles and animations
└── README.md         # This file
```

## Getting Started

### Prerequisites
- Modern web browser with SVG support
- Internet connection (for external CDN resources)

### Installation
1. Clone or download the project files
2. Open `index.html` in a web browser
3. No additional installation or build process required

### Usage

#### Basic Operation
1. **Enter Text**: Type your desired text in the input field
2. **Configure Settings**: Adjust letter height, LED count, and other parameters
3. **Generate**: Click "Populate" to render the letters with LED placement
4. **Customize**: Use the editor panel to modify colors, stroke width, and LED properties

#### Advanced Features
- **Character Selection**: Click on individual letters to select and modify them
- **LED Control**: Click on individual LEDs to access detailed control panel
- **Transform Tools**: Use toolbar buttons for rotation, scaling, and positioning
- **Unit Conversion**: Toggle between Imperial and Metric measurements

## Core Components

### LEDConfigurator Class (`main.js`)
Main application controller handling:
- Font loading and text rendering
- Event management and user interactions
- Transform operations (rotate, scale, move)
- Results calculation and display

### LEDPlacer Class (`led-placement.js`)
Advanced LED placement system featuring:
- Inner stroke positioning algorithm
- Normal vector calculations for proper LED orientation
- Optimal LED count determination
- Visual effects and animations

### UIComponents Class (`ui-components.js`)
Dynamic UI generation including:
- Configuration forms
- Control panels
- Results display
- Character library

### Configuration Data (`data.js`)
Comprehensive specifications for:
- Character dimensions and perimeter data
- LED module specifications
- Power supply options
- Default settings and calculations

## LED Placement Algorithm

The application uses a sophisticated algorithm to place LEDs on the inside of letter strokes:

1. **Path Analysis**: Analyzes the letter outline path to determine total length
2. **Normal Calculation**: Computes normal vectors at each LED position
3. **Offset Positioning**: Places LEDs inward from the stroke edge
4. **Even Distribution**: Ensures uniform LED spacing along the path
5. **Orientation**: Aligns LEDs perpendicular to the stroke direction

## Supported LED Modules

- **Tetra MAX 24V Small 71K**: 0.4W per module, 3 modules/foot
- **Tetra MAX 24V Medium 71K**: 0.5W per module, 2.5 modules/foot  
- **Tetra MAX 24V Large 71K**: 0.7W per module, 2 modules/foot

## Power Supply Options

- **GEPS24LT-100U-NA**: 100W, 24V
- **GEPS12LT-100U-NA**: 100W, 12V
- **GEPS24LT-60U-NA**: 60W, 24V

## Calculation Features

The application automatically calculates:
- **LED Module Count**: Based on character dimensions and LED density
- **Power Requirements**: Total wattage needed for all LEDs
- **Stroke Length**: Perimeter measurements for each character
- **Power Supply Count**: Number of power supplies required
- **Module Spacing**: Recommended spacing for optimal illumination
- **Circuit Length**: Total wire run length with safety margin

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Development

### Key Files to Modify

- **`main.js`**: Core application logic and event handling
- **`led-placement.js`**: LED positioning algorithms
- **`data.js`**: Character specifications and module data
- **`ui-components.js`**: Interface components and forms
- **`styles.css`**: Visual styling and animations

### Adding New Features

1. **New LED Modules**: Add specifications to `CONFIG_DATA.modules` in `data.js`
2. **Character Data**: Update `CONFIG_DATA.characterData` for new fonts or characters
3. **Effects**: Add new LED effects in `styles.css` and update the LEDPlacer class
4. **UI Components**: Extend the UIComponents class for new interface elements

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly across different browsers
5. Submit a pull request

## License

This project is proprietary software developed for Qwatt Technologies.

## Support

For technical support or feature requests, please contact the development team.

---

**Qwatt Technologies** - Professional LED Channel Letter Solutions
