// main.js - Main application logic and event handling

class LEDConfigurator {
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
            ledCountPerChar: {}
        };
        
        this.init();
    }

    async init() {
        await this.loadFont();
        this.attachEventListeners();
        this.setupInitialState();
    }

    async loadFont() {
        const loader = document.getElementById('loader');
        const populateBtn = document.getElementById('populateBtn');

        try {
            loader.style.display = 'block';
            populateBtn.disabled = true;

            // Try to load Roboto Slab font, with fallback to creating simple shapes
            try {
                this.font = await opentype.load('https://raw.githubusercontent.com/google/fonts/main/apache/robotoslab/RobotoSlab%5Bwght%5D.ttf');
            } catch (fontError) {
                console.warn("External font failed, using fallback:", fontError);
                // Create a simple fallback font object for basic shapes
                this.font = this.createFallbackFont();
            }

            loader.style.display = 'none';
            populateBtn.disabled = false;
        } catch (error) {
            console.error("Font loading error:", error);
            loader.style.display = 'none';

            const svgContainer = document.getElementById('svgContainer');
            svgContainer.innerHTML = `
                <div class="text-red-500 flex flex-col items-center">
                    <i class="fas fa-exclamation-triangle text-4xl mb-2"></i>
                    <p>Error loading font. Please check your connection.</p>
                </div>
            `;
        }
    }

    createFallbackFont() {
        // Create a minimal font object with basic letter shapes for testing
        return {
            getPath: (char, x, y, fontSize) => {
                const paths = this.getFallbackPaths(char, x, y, fontSize);
                return {
                    toPathData: () => paths
                };
            },
            getAdvanceWidth: (char, fontSize) => fontSize * 0.6
        };
    }

    getFallbackPaths(char, x, y, fontSize) {
        const scale = fontSize / 100;
        const offsetX = x;
        const offsetY = y;

        // Create simple letter shapes that will definitely have bounding boxes
        const w = 50 * scale; // width
        const h = 80 * scale; // height

        // Generic letter shape - filled rectangle with some detail
        const genericShape = `M ${offsetX} ${offsetY} L ${offsetX + w} ${offsetY} L ${offsetX + w} ${offsetY - h} L ${offsetX} ${offsetY - h} Z M ${offsetX + 10*scale} ${offsetY - 10*scale} L ${offsetX + w - 10*scale} ${offsetY - 10*scale} L ${offsetX + w - 10*scale} ${offsetY - h + 10*scale} L ${offsetX + 10*scale} ${offsetY - h + 10*scale} Z`;

        // Simple shapes for each letter
        const shapes = {
            'A': `M ${offsetX} ${offsetY} L ${offsetX + w} ${offsetY} L ${offsetX + w*0.8} ${offsetY - h} L ${offsetX + w*0.2} ${offsetY - h} Z M ${offsetX + w*0.25} ${offsetY - h*0.3} L ${offsetX + w*0.75} ${offsetY - h*0.3} L ${offsetX + w*0.7} ${offsetY - h*0.6} L ${offsetX + w*0.3} ${offsetY - h*0.6} Z`,
            'B': `M ${offsetX} ${offsetY} L ${offsetX + w*0.8} ${offsetY} L ${offsetX + w*0.8} ${offsetY - h*0.5} L ${offsetX + w*0.8} ${offsetY - h} L ${offsetX} ${offsetY - h} Z M ${offsetX + 10*scale} ${offsetY - 10*scale} L ${offsetX + w*0.7} ${offsetY - 10*scale} L ${offsetX + w*0.7} ${offsetY - h*0.4} L ${offsetX + 10*scale} ${offsetY - h*0.4} Z M ${offsetX + 10*scale} ${offsetY - h*0.6} L ${offsetX + w*0.7} ${offsetY - h*0.6} L ${offsetX + w*0.7} ${offsetY - h + 10*scale} L ${offsetX + 10*scale} ${offsetY - h + 10*scale} Z`,
            'C': `M ${offsetX} ${offsetY - h*0.2} L ${offsetX + w*0.8} ${offsetY} L ${offsetX + w*0.8} ${offsetY - h*0.2} L ${offsetX + w*0.2} ${offsetY - h*0.2} L ${offsetX + w*0.2} ${offsetY - h*0.8} L ${offsetX + w*0.8} ${offsetY - h*0.8} L ${offsetX + w*0.8} ${offsetY - h} L ${offsetX} ${offsetY - h*0.8} Z M ${offsetX + 10*scale} ${offsetY - h*0.3} L ${offsetX + w*0.7} ${offsetY - h*0.3} L ${offsetX + w*0.7} ${offsetY - h*0.7} L ${offsetX + 10*scale} ${offsetY - h*0.7} Z`
        };

        return shapes[char.toUpperCase()] || genericShape;
    }

    attachEventListeners() {
        // Main controls
        const populateBtn = document.getElementById('populateBtn');
        const clearBtn = document.getElementById('clearBtn');
        const yourText = document.getElementById('yourText');
        
        if (populateBtn) {
            populateBtn.addEventListener('click', () => this.renderText());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearCanvas());
        }
        
        if (yourText) {
            yourText.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.renderText();
            });
        }
        
        // Toolbar controls
        this.attachToolbarListeners();
        
        // Editor controls
        this.attachEditorListeners();
        
        // LED Control Panel
        this.attachLEDControlListeners();
        
        // Unit toggle
        const unitToggle = document.getElementById('unitToggle');
        if (unitToggle) {
            unitToggle.addEventListener('change', () => this.updateUnits());
        }
        
        // Tab switching
        this.attachTabListeners();
        
        // Document-wide drag events
        document.addEventListener('mousemove', (e) => this.dragElement(e));
        document.addEventListener('mouseup', () => this.stopDragging());
    }

    attachToolbarListeners() {
        const buttons = {
            'rotateLeft': () => this.rotate(-15),
            'rotateRight': () => this.rotate(15),
            'moveUp': () => this.move(0, -10),
            'moveDown': () => this.move(0, 10),
            'scaleUp': () => this.zoom(1.1),
            'scaleDown': () => this.zoom(0.9),
            'increaseLeds': () => this.changeLEDCount(1),
            'decreaseLeds': () => this.changeLEDCount(-1),
            'clearCanvas': () => this.clearCanvas()
        };
        
        for (const [id, handler] of Object.entries(buttons)) {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', handler);
        }
    }

    attachEditorListeners() {
        // Stroke controls
        const strokeColor = document.getElementById('strokeColor');
        const strokeWidth = document.getElementById('strokeWidth');
        const ledColor = document.getElementById('ledColor');
        
        if (strokeColor) {
            strokeColor.addEventListener('input', (e) => {
                document.getElementById('strokeColorValue').textContent = e.target.value;
                this.updateStrokeStyle();
            });
        }
        
        if (strokeWidth) {
            strokeWidth.addEventListener('input', () => this.updateStrokeStyle());
        }
        
        if (ledColor) {
            ledColor.addEventListener('input', (e) => {
                document.getElementById('ledColorValue').textContent = e.target.value;
                this.updateAllLEDColors(e.target.value);
            });
        }
        
        // LED count controls
        const increaseLedCount = document.getElementById('increaseLedCount');
        const decreaseLedCount = document.getElementById('decreaseLedCount');
        const ledCount = document.getElementById('ledCount');
        
        if (increaseLedCount) {
            increaseLedCount.addEventListener('click', () => {
                ledCount.value = parseInt(ledCount.value) + 1;
                this.renderText();
            });
        }
        
        if (decreaseLedCount) {
            decreaseLedCount.addEventListener('click', () => {
                if (parseInt(ledCount.value) > 1) {
                    ledCount.value = parseInt(ledCount.value) - 1;
                    this.renderText();
                }
            });
        }
        
        // Character library
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('character-card')) {
                const char = e.target.dataset.char;
                const textInput = document.getElementById('yourText');
                textInput.value += char;
            }
        });
    }

    attachLEDControlListeners() {
        const individualLedColor = document.getElementById('individualLedColor');
        const ledBrightness = document.getElementById('ledBrightness');
        const ledEffect = document.getElementById('ledEffect');
        const applyToAll = document.getElementById('applyToAllLeds');
        const applyToCharacter = document.getElementById('applyToCharacterLeds');
        
        if (individualLedColor) {
            individualLedColor.addEventListener('input', () => this.updateLEDPreview());
        }
        
        if (ledBrightness) {
            ledBrightness.addEventListener('input', () => this.updateLEDPreview());
        }
        
        if (applyToAll) {
            applyToAll.addEventListener('click', () => this.applyLEDSettingsToAll());
        }
        
        if (applyToCharacter) {
            applyToCharacter.addEventListener('click', () => this.applyLEDSettingsToCharacter());
        }
    }

    attachTabListeners() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs
                tabs.forEach(t => {
                    t.classList.remove('tab-active');
                    const indicator = t.querySelector('.tab-indicator');
                    if (indicator) indicator.style.transform = 'scaleX(0)';
                });
                
                // Add active class to clicked tab
                tab.classList.add('tab-active');
                const indicator = tab.querySelector('.tab-indicator');
                if (indicator) indicator.style.transform = 'scaleX(1)';
            });
        });
    }

    setupInitialState() {
        // Set default LED count based on letter height
        const heightInput = document.getElementById('height');
        if (heightInput) {
            this.calculateOptimalLEDCount();
            heightInput.addEventListener('change', () => this.calculateOptimalLEDCount());
        }
    }

    calculateOptimalLEDCount() {
        const heightInput = document.getElementById('height');
        const ledCountInput = document.getElementById('ledCount');
        
        if (heightInput && ledCountInput) {
            const height = parseFloat(heightInput.value);
            // Calculate based on height - roughly 1 LED per 6-7 inches
            const optimalCount = Math.max(3, Math.round(height / 7));
            
            // Store as default for each character
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            for (let char of chars) {
                this.state.ledCountPerChar[char] = optimalCount;
            }
        }
    }

    async renderText() {
        const textInput = document.getElementById('yourText');
        const text = textInput.value.trim();
        
        if (!text || !this.font) return;
        
        const loader = document.getElementById('loader');
        loader.style.display = 'block';
        
        this.state.currentText = text;
        
        // Clear and setup SVG
        const svgContainer = document.getElementById('svgContainer');
        svgContainer.innerHTML = '';
        
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        
        const mainGroup = document.createElementNS(svgNS, "g");
        mainGroup.setAttribute("id", "mainGroup");
        mainGroup.setAttribute("transform", 
            `translate(0, ${this.state.translateY}) rotate(${this.state.rotation}) scale(${this.state.scale})`);
        
        // Render each character
        let xOffset = 20;
        const fontSize = CONFIG_DATA.defaults.fontSize;
        const ledCount = parseInt(document.getElementById('ledCount').value);
        
        for (const char of text.toUpperCase()) {
            if (char === ' ') {
                xOffset += fontSize * 0.5;
                continue;
            }
            
            const charGroup = this.createCharacterGroup(char, xOffset, fontSize, ledCount);
            if (charGroup) {
                mainGroup.appendChild(charGroup);
                
                // Get advance width for next character
                const path = this.font.getPath(char, 0, 0, fontSize);
                const advanceWidth = this.font.getAdvanceWidth(char, fontSize);
                xOffset += advanceWidth + CONFIG_DATA.defaults.letterSpacing;
            }
        }
        
        svg.appendChild(mainGroup);

        // Set viewBox
        svgContainer.appendChild(svg);
        const bbox = mainGroup.getBBox();
        svg.setAttribute("viewBox",
            `${bbox.x - 20} ${bbox.y - 20} ${bbox.width + 40} ${bbox.height + 40}`);

        // Now that all characters are in the DOM, place LEDs
        const ledColor = document.getElementById('ledColor').value;
        document.querySelectorAll('.character-group').forEach(charGroup => {
            const outlinePath = charGroup.querySelector('.letter-outline');
            if (outlinePath) {
                console.log('Placing LEDs for character, bbox now:', outlinePath.getBBox());
                this.ledPlacer.placeLEDsInside(outlinePath, charGroup, ledCount, {
                    color: ledColor,
                    brightness: 100,
                    effect: 'none'
                });
            }
        });

        loader.style.display = 'none';

        // Calculate results
        this.calculateResults();

        // Attach interaction listeners
        this.attachInteractionListeners();
    }

    createCharacterGroup(char, xOffset, fontSize, ledCount) {
        const svgNS = "http://www.w3.org/2000/svg";
        const charGroup = document.createElementNS(svgNS, "g");
        charGroup.setAttribute("class", "character-group");
        charGroup.setAttribute("data-char", char);
        
        // Get path from font
        const path = this.font.getPath(char, xOffset, fontSize * 0.8, fontSize);
        const pathData = path.toPathData(2);

        console.log('Character:', char, 'Path data:', pathData);

        // Create outline path
        const pathElement = document.createElementNS(svgNS, "path");
        pathElement.setAttribute("d", pathData);
        pathElement.setAttribute("class", "letter-outline");
        pathElement.setAttribute("stroke", document.getElementById('strokeColor').value);
        pathElement.setAttribute("stroke-width", document.getElementById('strokeWidth').value);
        pathElement.setAttribute("fill", "none");
        charGroup.appendChild(pathElement);

        // Add white fill for letter body
        const fillPath = document.createElementNS(svgNS, "path");
        fillPath.setAttribute("d", pathData);
        fillPath.setAttribute("class", "letter-fill");
        fillPath.setAttribute("fill", "white");
        fillPath.setAttribute("stroke", "none");
        charGroup.appendChild(fillPath);

        return charGroup;
    }

    attachInteractionListeners() {
        // Character selection
        document.querySelectorAll('.character-group').forEach(group => {
            group.addEventListener('mousedown', (e) => this.startDragging(e, group));
            group.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectCharacter(group);
            });
        });
        
        // LED selection
        document.querySelectorAll('.led-strip').forEach(led => {
            led.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectLED(led);
            });
        });
    }

    selectCharacter(charGroup) {
        // Deselect previous
        if (this.state.selectedCharGroup) {
            const prevOutline = this.state.selectedCharGroup.querySelector('.letter-outline');
            if (prevOutline) prevOutline.classList.remove('selected');
        }
        
        // Hide LED control panel
        const ledControlPanel = document.querySelector('.led-control-panel');
        if (ledControlPanel) ledControlPanel.classList.remove('active');
        
        // Select new
        this.state.selectedCharGroup = charGroup;
        const outline = charGroup.querySelector('.letter-outline');
        if (outline) outline.classList.add('selected');
    }

    selectLED(led) {
        // Deselect previous LED
        if (this.state.selectedLed) {
            this.state.selectedLed.classList.remove('selected');
        }
        
        // Select new LED
        this.state.selectedLed = led;
        led.classList.add('selected');
        
        // Show LED control panel
        const ledControlPanel = document.querySelector('.led-control-panel');
        if (ledControlPanel) {
            ledControlPanel.classList.add('active');
            
            // Update controls with LED properties
            document.getElementById('individualLedColor').value = led.getAttribute('data-color') || '#666666';
            document.getElementById('ledBrightness').value = led.getAttribute('data-brightness') || '100';
            document.getElementById('ledEffect').value = led.getAttribute('data-effect') || 'none';
            
            this.updateLEDPreview();
        }
    }

    updateLEDPreview() {
        const preview = document.getElementById('ledPreview');
        const color = document.getElementById('individualLedColor').value;
        const brightness = document.getElementById('ledBrightness').value;
        
        if (preview) {
            preview.style.backgroundColor = color;
            preview.style.opacity = brightness / 100;
            preview.style.boxShadow = `0 0 10px ${color}`;
        }
        
        // Update selected LED
        if (this.state.selectedLed) {
            this.state.selectedLed.style.fill = color;
            this.state.selectedLed.style.opacity = brightness / 100;
            this.state.selectedLed.setAttribute('data-color', color);
            this.state.selectedLed.setAttribute('data-brightness', brightness);
        }
    }

    applyLEDSettingsToAll() {
        const color = document.getElementById('individualLedColor').value;
        const brightness = document.getElementById('ledBrightness').value;
        const effect = document.getElementById('ledEffect').value;
        
        document.querySelectorAll('.led-strip').forEach(led => {
            led.style.fill = color;
            led.style.opacity = brightness / 100;
            led.setAttribute('data-color', color);
            led.setAttribute('data-brightness', brightness);
            
            // Apply effect
            led.classList.remove('led-effect-blink', 'led-effect-pulse', 'led-effect-chase');
            if (effect !== 'none') {
                led.classList.add(`led-effect-${effect}`);
            }
        });
    }

    applyLEDSettingsToCharacter() {
        if (!this.state.selectedCharGroup) return;
        
        const color = document.getElementById('individualLedColor').value;
        const brightness = document.getElementById('ledBrightness').value;
        const effect = document.getElementById('ledEffect').value;
        
        this.state.selectedCharGroup.querySelectorAll('.led-strip').forEach(led => {
            led.style.fill = color;
            led.style.opacity = brightness / 100;
            led.setAttribute('data-color', color);
            led.setAttribute('data-brightness', brightness);
            
            // Apply effect
            led.classList.remove('led-effect-blink', 'led-effect-pulse', 'led-effect-chase');
            if (effect !== 'none') {
                led.classList.add(`led-effect-${effect}`);
            }
        });
    }

    calculateResults() {
        const resultsPanel = document.getElementById('resultsPanel');
        if (!resultsPanel) return;
        
        resultsPanel.classList.remove('hidden');
        
        const text = this.state.currentText.toUpperCase();
        const selectedModule = CONFIG_DATA.modules[document.getElementById('module').value];
        const selectedPowerSupply = CONFIG_DATA.powerSupplies[document.getElementById('powerSupply').value];
        const letterHeightInches = parseFloat(document.getElementById('height').value);
        const letterHeightFeet = letterHeightInches / 12;
        const ledCount = parseInt(document.getElementById('ledCount').value);
        
        let totalModules = 0;
        let totalPerimeter = 0;
        
        for (const char of text) {
            if (char === ' ' || !CONFIG_DATA.characterData[char]) continue;
            const charData = CONFIG_DATA.characterData[char];
            totalModules += ledCount;
            totalPerimeter += charData.perimeter * letterHeightFeet;
        }
        
        const unit = document.getElementById('unitToggle').checked ? 'cm' : 'in';
        const perimeterValue = document.getElementById('unitToggle').checked ? 
            (totalPerimeter * 12 * 2.54).toFixed(1) : 
            (totalPerimeter * 12).toFixed(1);
        
        document.getElementById('modulesCount').textContent = totalModules;
        document.getElementById('strokeLength').textContent = `${perimeterValue} ${unit}`;
        
        const powerRequiredValue = totalModules * selectedModule.wattsPerModule;
        document.getElementById('powerRequired').textContent = `${powerRequiredValue.toFixed(1)} W`;
        
        const powerSuppliesNeeded = Math.ceil(powerRequiredValue / selectedPowerSupply.maxWatts);
        document.getElementById('powerSuppliesCount').textContent = powerSuppliesNeeded;
        
        const avgSpacing = totalModules > 0 ? (totalPerimeter * 12) / totalModules : 0;
        const recommendedSpacingValue = document.getElementById('unitToggle').checked ? 
            (avgSpacing * 2.54).toFixed(1) : avgSpacing.toFixed(1);
        document.getElementById('recommendedSpacing').textContent = `${recommendedSpacingValue} ${unit}`;
        
        const circuitLengthValue = totalPerimeter * 12 * 1.2;
        const circuitLengthDisplay = document.getElementById('unitToggle').checked ? 
            (circuitLengthValue * 2.54).toFixed(1) : circuitLengthValue.toFixed(1);
        document.getElementById('circuitLength').textContent = `${circuitLengthDisplay} ${unit}`;
    }

    // Transform methods
    rotate(angle) {
        this.state.rotation += angle;
        this.updateTransform();
    }

    move(dx, dy) {
        this.state.translateY += dy;
        this.updateTransform();
    }

    zoom(factor) {
        this.state.scale *= factor;
        this.updateTransform();
    }

    updateTransform() {
        const mainGroup = document.getElementById('mainGroup');
        if (mainGroup) {
            mainGroup.setAttribute('transform', 
                `translate(0, ${this.state.translateY}) rotate(${this.state.rotation}) scale(${this.state.scale})`);
        }
    }

    changeLEDCount(delta) {
        const ledCount = document.getElementById('ledCount');
        const newValue = parseInt(ledCount.value) + delta;
        if (newValue >= 1) {
            ledCount.value = newValue;
            this.renderText();
        }
    }

    updateStrokeStyle() {
        if (!this.state.selectedCharGroup) return;
        
        const outline = this.state.selectedCharGroup.querySelector('.letter-outline');
        if (outline) {
            outline.setAttribute('stroke', document.getElementById('strokeColor').value);
            outline.setAttribute('stroke-width', document.getElementById('strokeWidth').value);
        }
    }

    updateAllLEDColors(color) {
        document.querySelectorAll('.led-strip').forEach(led => {
            led.style.fill = color;
            led.setAttribute('data-color', color);
        });
    }

    clearCanvas() {
        document.getElementById('yourText').value = '';
        document.getElementById('svgContainer').innerHTML = `
            <div class="text-gray-400 flex flex-col items-center">
                <i class="fas fa-lightbulb text-4xl mb-2"></i>
                <p>Enter your text and click "Populate" to begin</p>
            </div>
        `;
        document.getElementById('resultsPanel').classList.add('hidden');
        document.querySelector('.led-control-panel').classList.remove('active');
        this.state.currentText = '';
    }

    updateUnits() {
        const isMetric = document.getElementById('unitToggle').checked;
        const units = ['heightUnit', 'depthUnit', 'modulePitchUnit'];
        
        units.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = isMetric ? 'cm' : 'in';
        });
        
        if (this.state.currentText) {
            this.calculateResults();
        }
    }

    // Dragging functionality
    startDragging(e, element) {
        e.preventDefault();
        e.stopPropagation();
        this.state.isDragging = true;
        this.state.currentElement = element;
        
        const transform = element.getAttribute("transform") || "";
        const translateMatch = transform.match(/translate\(([^,]+)\s*,?\s*([^)]+)\)/);
        
        let currentX = 0, currentY = 0;
        if (translateMatch) {
            currentX = parseFloat(translateMatch[1]);
            currentY = parseFloat(translateMatch[2]);
        }

        const CTM = document.querySelector('svg').getScreenCTM();
        this.state.dragOffsetX = (e.clientX - CTM.e) / CTM.a - currentX;
        this.state.dragOffsetY = (e.clientY - CTM.f) / CTM.d - currentY;
    }

    dragElement(e) {
        if (!this.state.isDragging || !this.state.currentElement) return;
        e.preventDefault();
        
        const CTM = document.querySelector('svg').getScreenCTM();
        const newX = (e.clientX - CTM.e) / CTM.a - this.state.dragOffsetX;
        const newY = (e.clientY - CTM.f) / CTM.d - this.state.dragOffsetY;
        
        this.state.currentElement.setAttribute("transform", `translate(${newX}, ${newY})`);
    }

    stopDragging() {
        this.state.isDragging = false;
        this.state.currentElement = null;
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.ledConfigurator = new LEDConfigurator();
});