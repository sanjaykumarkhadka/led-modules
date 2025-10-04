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

    async loadFont(languageCode = 'en') {
        const loader = document.getElementById('loader');
        const populateBtn = document.getElementById('populateBtn');

        try {
            loader.style.display = 'block';
            populateBtn.disabled = true;

            // Font mapping for different languages
            const fontUrls = {
                'en': 'https://raw.githubusercontent.com/google/fonts/main/apache/robotoslab/RobotoSlab%5Bwght%5D.ttf',
                'es': 'https://raw.githubusercontent.com/google/fonts/main/apache/robotoslab/RobotoSlab%5Bwght%5D.ttf',
                'fr': 'https://raw.githubusercontent.com/google/fonts/main/apache/robotoslab/RobotoSlab%5Bwght%5D.ttf',
                'hi': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth%2Cwght%5D.ttf',
                'kn': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskannada/NotoSansKannada%5Bwdth%2Cwght%5D.ttf',
                'ta': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstamil/NotoSansTamil%5Bwdth%2Cwght%5D.ttf',
                'te': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstelugu/NotoSansTelugu%5Bwdth%2Cwght%5D.ttf',
                'bn': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansbengali/NotoSansBengali%5Bwdth%2Cwght%5D.ttf',
                'or': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansoriya/NotoSansOriya%5Bwdth%2Cwght%5D.ttf',
                'ml': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansmalayalam/NotoSansMalayalam%5Bwdth%2Cwght%5D.ttf'
            };

            const fontUrl = fontUrls[languageCode] || fontUrls['en'];

            // Try to load the selected font
            try {
                this.font = await opentype.load(fontUrl);
                this.currentLanguage = languageCode;
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

        return shapes[char.toUpperCase()] || shapes[char] || genericShape;
    }

    attachEventListeners() {
        // Main controls
        const populateBtn = document.getElementById('populateBtn');
        const clearBtn = document.getElementById('clearBtn');
        const yourText = document.getElementById('yourText');
        const pdfBtn = document.getElementById('pdfBtn');
        
        if (populateBtn) {
            populateBtn.addEventListener('click', () => this.renderText());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearCanvas());
        }
        
        if (yourText) {
            yourText.addEventListener('keydown', (e) => {
                // Limit to 2 lines
                const lines = yourText.value.split('\n');
                if (e.key === 'Enter' && lines.length >= 2) {
                    e.preventDefault();
                }
            });
        }

        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => this.generatePDF());
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

        // Language selector
        const languageSelect = document.getElementById('language');
        if (languageSelect) {
            languageSelect.addEventListener('change', async (e) => {
                await this.loadFont(e.target.value);
                // Re-render text if any exists
                if (this.state.currentText) {
                    this.renderText();
                }
            });
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

        // Split text into lines (max 2 lines)
        const lines = text.split('\n').slice(0, 2);
        const fontSize = CONFIG_DATA.defaults.fontSize;
        const lineSpacing = CONFIG_DATA.defaults.lineSpacing;
        const ledCount = parseInt(document.getElementById('ledCount').value);

        // Render each line
        let yOffset = 20;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            let xOffset = 20;

            // Create a group for this line
            const lineGroup = document.createElementNS(svgNS, "g");
            lineGroup.setAttribute("class", "line-group");
            lineGroup.setAttribute("data-line", lineIndex);

            for (const char of line) {
                if (char === ' ') {
                    xOffset += fontSize * 0.5;
                    continue;
                }

                const charGroup = this.createCharacterGroup(char, xOffset, fontSize + yOffset, ledCount);
                if (charGroup) {
                    lineGroup.appendChild(charGroup);

                    // Get advance width for next character
                    const path = this.font.getPath(char, 0, 0, fontSize);
                    const advanceWidth = this.font.getAdvanceWidth(char, fontSize);
                    xOffset += advanceWidth + CONFIG_DATA.defaults.letterSpacing;
                }
            }

            mainGroup.appendChild(lineGroup);

            // Move to next line
            yOffset += fontSize + lineSpacing;
        }
        
        svg.appendChild(mainGroup);

        // Set viewBox
        svgContainer.appendChild(svg);
        const bbox = mainGroup.getBBox();

        // Add height measurement annotation on the left side (before final bbox calculation)
        this.addHeightMeasurement(mainGroup, bbox);

        // Recalculate bbox to include measurement
        const finalBbox = mainGroup.getBBox();
        svg.setAttribute("viewBox",
            `${finalBbox.x - 20} ${finalBbox.y - 20} ${finalBbox.width + 40} ${finalBbox.height + 60}`);

        // Now that all characters are in the DOM, place LEDs
        const ledColor = document.getElementById('ledColor').value;
        document.querySelectorAll('.character-group').forEach(charGroup => {
            const outlinePath = charGroup.querySelector('.letter-outline');
            const char = charGroup.getAttribute('data-char');

            if (outlinePath && char) {
                // Get LED count for this specific character (default to global count)
                const charLedCount = this.state.ledCountPerChar[char] || ledCount;

                console.log(`Placing ${charLedCount} LEDs for character '${char}', bbox:`, outlinePath.getBBox());
                this.ledPlacer.placeLEDsInside(outlinePath, charGroup, charLedCount, {
                    color: ledColor,
                    brightness: 100,
                    effect: 'none'
                });

                // Add LED count display below each character
                this.addCharacterLEDCountDisplay(charGroup, char, charLedCount);
            }
        });

        // Update total LED count
        this.updateTotalLEDCount();

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
        // Close any existing popup first
        this.hideCharacterLEDControls();

        // Deselect previous
        if (this.state.selectedCharGroup) {
            const prevOutline = this.state.selectedCharGroup.querySelector('.letter-outline');
            if (prevOutline) prevOutline.classList.remove('selected');
        }

        // Select new
        this.state.selectedCharGroup = charGroup;
        const outline = charGroup.querySelector('.letter-outline');
        if (outline) outline.classList.add('selected');

        // Show character-specific LED controls
        this.showCharacterLEDControls(charGroup);
    }

    showCharacterLEDControls(charGroup) {
        const char = charGroup.getAttribute('data-char');
        const currentLedCount = this.state.ledCountPerChar[char] || parseInt(document.getElementById('ledCount').value);

        // Remove any existing panel first
        const existingPanel = document.getElementById('characterLEDControl');
        if (existingPanel) {
            existingPanel.remove();
        }

        // Create new character LED control panel
        const charControlPanel = document.createElement('div');
        charControlPanel.id = 'characterLEDControl';
        charControlPanel.className = 'character-led-control-panel';
        charControlPanel.innerHTML = `
                <div class="bg-white p-4 rounded-lg shadow-lg border-2 border-blue-500">
                    <h3 class="text-lg font-semibold mb-3">Letter '<span id="selectedChar"></span>' LED Control</h3>
                    <div class="flex items-center space-x-3 mb-3">
                        <label class="text-sm font-medium">LED Count:</label>
                        <button id="decreaseCharLeds" class="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" id="charLedCount" value="${currentLedCount}" min="1" max="20" class="w-16 text-center border border-gray-300 rounded px-2 py-1">
                        <button id="increaseCharLeds" class="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div class="flex space-x-2">
                        <button id="applyCharLeds" class="px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">Apply</button>
                        <button id="closeCharControl" class="px-4 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(charControlPanel);

        // Add event listeners with proper binding
        const decreaseBtn = charControlPanel.querySelector('#decreaseCharLeds');
        const increaseBtn = charControlPanel.querySelector('#increaseCharLeds');
        const applyBtn = charControlPanel.querySelector('#applyCharLeds');
        const closeBtn = charControlPanel.querySelector('#closeCharControl');

        decreaseBtn.onclick = () => {
            const input = charControlPanel.querySelector('#charLedCount');
            if (parseInt(input.value) > 1) {
                input.value = parseInt(input.value) - 1;
            }
        };

        increaseBtn.onclick = () => {
            const input = charControlPanel.querySelector('#charLedCount');
            if (parseInt(input.value) < 20) {
                input.value = parseInt(input.value) + 1;
            }
        };

        applyBtn.onclick = () => {
            // Disable button to prevent multiple clicks
            applyBtn.disabled = true;
            applyBtn.textContent = 'Applying...';

            setTimeout(() => {
                try {
                    this.applyCharacterLEDCount();
                } catch (error) {
                    console.error('Error in applyCharacterLEDCount:', error);
                } finally {
                    // Re-enable button
                    applyBtn.disabled = false;
                    applyBtn.textContent = 'Apply';
                }
            }, 100);
        };

        closeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Close button clicked - force closing');

            // Force close - remove panel immediately
            if (charControlPanel && charControlPanel.parentNode) {
                charControlPanel.parentNode.removeChild(charControlPanel);
                console.log('Panel force removed');
            }

            // Clear selection
            if (this.state.selectedCharGroup) {
                const outline = this.state.selectedCharGroup.querySelector('.letter-outline');
                if (outline) outline.classList.remove('selected');
                this.state.selectedCharGroup = null;
                console.log('Character force deselected');
            }
        };

        // Update panel content
        charControlPanel.querySelector('#selectedChar').textContent = char;
        charControlPanel.querySelector('#charLedCount').value = currentLedCount;

        // Position panel next to selected character
        const rect = charGroup.getBoundingClientRect();
        charControlPanel.style.position = 'fixed';
        charControlPanel.style.left = (rect.right + 10) + 'px';
        charControlPanel.style.top = rect.top + 'px';
        charControlPanel.style.zIndex = '1000';
        charControlPanel.style.display = 'block';

        // Add escape key to close
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.hideCharacterLEDControls();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    applyCharacterLEDCount() {
        console.log('Starting applyCharacterLEDCount');

        if (!this.state.selectedCharGroup) {
            console.warn('No character selected');
            return;
        }

        const char = this.state.selectedCharGroup.getAttribute('data-char');
        const charLedCountInput = document.querySelector('#characterLEDControl #charLedCount');

        if (!charLedCountInput) {
            console.warn('LED count input not found');
            return;
        }

        const newLedCount = parseInt(charLedCountInput.value);

        if (!char || isNaN(newLedCount) || newLedCount < 1 || newLedCount > 20) {
            console.warn('Invalid character or LED count:', { char, newLedCount });
            return;
        }

        console.log(`Applying ${newLedCount} LEDs to character '${char}'`);

        // Store the new LED count for this character
        this.state.ledCountPerChar[char] = newLedCount;

        // Remove existing LEDs for this character
        const existingLeds = this.state.selectedCharGroup.querySelectorAll('.led-strip');
        console.log(`Removing ${existingLeds.length} existing LEDs`);
        existingLeds.forEach(led => led.remove());

        // Recreate LEDs with new count
        const outlinePath = this.state.selectedCharGroup.querySelector('.letter-outline');
        const ledColor = '#888888'; // Fixed color like in example

        if (outlinePath) {
            this.ledPlacer.placeLEDsInside(outlinePath, this.state.selectedCharGroup, newLedCount, {
                color: ledColor,
                brightness: 100,
                effect: 'none'
            });
        }

        console.log(`Successfully updated character '${char}' to ${newLedCount} LEDs`);

        // Update the LED count display below the character
        this.updateCharacterLEDCountDisplay(char, newLedCount);

        // Update total LED count and recalculate results immediately
        this.updateTotalLEDCount();
        this.calculateResults();

        console.log('Finished applyCharacterLEDCount');
    }

    updateCharacterLEDCountDisplay(char, ledCount) {
        // Find or create LED count display below the character
        const charGroup = this.state.selectedCharGroup;
        if (!charGroup) return;

        // Remove existing count display
        const existingCount = charGroup.querySelector('.led-count-display');
        if (existingCount) {
            existingCount.remove();
        }

        // Create new count display
        const bbox = charGroup.getBBox();
        const countText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        countText.setAttribute("x", bbox.x + bbox.width / 2);
        countText.setAttribute("y", bbox.y + bbox.height + 25);
        countText.setAttribute("text-anchor", "middle");
        countText.setAttribute("font-size", "16");
        countText.setAttribute("font-weight", "bold");
        countText.setAttribute("fill", "#333");
        countText.setAttribute("class", "led-count-display");
        countText.textContent = ledCount.toString();

        charGroup.appendChild(countText);
    }

    updateTotalLEDCount() {
        // Calculate total LED count across all characters
        let totalCount = 0;
        const defaultLedCount = parseInt(document.getElementById('ledCount').value) || 5;

        for (const char of this.state.currentText) {
            if (char !== ' ' && char !== '\n') {
                const charLedCount = this.state.ledCountPerChar[char] || defaultLedCount;
                totalCount += charLedCount;
                console.log(`Character '${char}': ${charLedCount} LEDs`);
            }
        }

        // Update results panel
        const modulesCountElement = document.getElementById('modulesCount');
        if (modulesCountElement) {
            modulesCountElement.textContent = totalCount;
        }

        // Also update any other total count displays
        const totalCountDisplays = document.querySelectorAll('.total-led-count');
        totalCountDisplays.forEach(display => {
            display.textContent = totalCount;
        });

        console.log('Total LED count updated to:', totalCount);
        return totalCount;
    }

    addCharacterLEDCountDisplay(charGroup, char, ledCount) {
        // Add LED count display below the character
        const bbox = charGroup.getBBox();
        const countText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        countText.setAttribute("x", bbox.x + bbox.width / 2);
        countText.setAttribute("y", bbox.y + bbox.height + 25);
        countText.setAttribute("text-anchor", "middle");
        countText.setAttribute("font-size", "16");
        countText.setAttribute("font-weight", "bold");
        countText.setAttribute("fill", "#333");
        countText.setAttribute("class", "led-count-display");
        countText.textContent = ledCount.toString();

        charGroup.appendChild(countText);
    }

    addHeightMeasurement(mainGroup, bbox) {
        const svgNS = "http://www.w3.org/2000/svg";

        // Get the height input value
        const heightInput = document.getElementById('height');
        const heightValue = heightInput ? parseFloat(heightInput.value).toFixed(1) : "35.0";

        // Create measurement group
        const measurementGroup = document.createElementNS(svgNS, "g");
        measurementGroup.setAttribute("class", "height-measurement");

        // Vertical line on the left
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", bbox.x - 40);
        line.setAttribute("y1", bbox.y);
        line.setAttribute("x2", bbox.x - 40);
        line.setAttribute("y2", bbox.y + bbox.height);
        line.setAttribute("stroke", "#333");
        line.setAttribute("stroke-width", "2");
        measurementGroup.appendChild(line);

        // Top horizontal tick
        const topTick = document.createElementNS(svgNS, "line");
        topTick.setAttribute("x1", bbox.x - 45);
        topTick.setAttribute("y1", bbox.y);
        topTick.setAttribute("x2", bbox.x - 35);
        topTick.setAttribute("y2", bbox.y);
        topTick.setAttribute("stroke", "#333");
        topTick.setAttribute("stroke-width", "2");
        measurementGroup.appendChild(topTick);

        // Bottom horizontal tick
        const bottomTick = document.createElementNS(svgNS, "line");
        bottomTick.setAttribute("x1", bbox.x - 45);
        bottomTick.setAttribute("y1", bbox.y + bbox.height);
        bottomTick.setAttribute("x2", bbox.x - 35);
        bottomTick.setAttribute("y2", bbox.y + bbox.height);
        bottomTick.setAttribute("stroke", "#333");
        bottomTick.setAttribute("stroke-width", "2");
        measurementGroup.appendChild(bottomTick);

        // Height text
        const heightText = document.createElementNS(svgNS, "text");
        heightText.setAttribute("x", bbox.x - 60);
        heightText.setAttribute("y", bbox.y + bbox.height / 2);
        heightText.setAttribute("text-anchor", "end");
        heightText.setAttribute("dominant-baseline", "middle");
        heightText.setAttribute("font-size", "18");
        heightText.setAttribute("font-weight", "normal");
        heightText.setAttribute("fill", "#333");
        heightText.textContent = `${heightValue}"`;
        measurementGroup.appendChild(heightText);

        mainGroup.appendChild(measurementGroup);
    }

    hideCharacterLEDControls() {
        console.log('Attempting to hide character LED controls');

        const charControlPanel = document.getElementById('characterLEDControl');
        if (charControlPanel) {
            charControlPanel.style.display = 'none';
            charControlPanel.remove(); // Completely remove the panel
            console.log('Character control panel removed');
        }

        // Deselect character
        if (this.state.selectedCharGroup) {
            const outline = this.state.selectedCharGroup.querySelector('.letter-outline');
            if (outline) outline.classList.remove('selected');
            this.state.selectedCharGroup = null;
            console.log('Character deselected');
        }
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

        const text = this.state.currentText;
        const selectedModule = CONFIG_DATA.modules[document.getElementById('module').value];
        const selectedPowerSupply = CONFIG_DATA.powerSupplies[document.getElementById('powerSupply').value];
        const letterHeightInches = parseFloat(document.getElementById('height').value);
        const letterHeightFeet = letterHeightInches / 12;
        const defaultLedCount = parseInt(document.getElementById('ledCount').value);

        let totalModules = 0;
        let totalPerimeter = 0;

        // Process all characters including newlines
        for (const char of text) {
            if (char === ' ' || char === '\n' || !CONFIG_DATA.characterData[char]) continue;
            const charData = CONFIG_DATA.characterData[char];
            // Use per-character LED count if available, otherwise use default
            const charLedCount = this.state.ledCountPerChar[char] || defaultLedCount;
            totalModules += charLedCount;
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

    generatePDF() {
        if (!this.state.currentText) {
            alert('Please populate text first before generating PDF');
            return;
        }

        // Get current date and time for filename
        const now = new Date();
        const dateStr = `${now.getMonth() + 1}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
        const timeStr = `${String(now.getHours()).padStart(2, '0')} ${String(now.getMinutes()).padStart(2, '0')}`;
        const filename = `Channel Letter ${dateStr} ${timeStr}.pdf`;

        // Import jsPDF (we'll need to add this library to the HTML)
        if (typeof window.jspdf === 'undefined') {
            alert('PDF library not loaded. Please add jsPDF library to the page.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Add Qwatt Technologies header
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('Qwatt Technologies', 148, 15, { align: 'center' });

        // Add date/time
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated: ${dateStr} ${timeStr}`, 148, 22, { align: 'center' });

        // Add title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Channel Letter Configuration', 148, 32, { align: 'center' });

        // Get SVG element
        const svg = document.querySelector('#svgContainer svg');
        if (svg) {
            // Convert SVG to canvas then to image
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                const imgData = canvas.toDataURL('image/png');

                // Add SVG image to PDF
                const imgWidth = 250;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                doc.addImage(imgData, 'PNG', 23, 40, imgWidth, Math.min(imgHeight, 100));

                // Add specifications table
                const startY = 40 + Math.min(imgHeight, 100) + 10;
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Specifications', 20, startY);

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');

                const specs = [
                    ['Text:', this.state.currentText],
                    ['Height:', document.getElementById('height')?.value + ' inches'],
                    ['Total LED Modules:', document.getElementById('modulesCount')?.textContent || '0'],
                    ['Power Required:', document.getElementById('powerRequired')?.textContent || '0 W'],
                    ['Power Supplies Needed:', document.getElementById('powerSuppliesCount')?.textContent || '0']
                ];

                let yPos = startY + 8;
                specs.forEach(([label, value]) => {
                    doc.setFont('helvetica', 'bold');
                    doc.text(label, 20, yPos);
                    doc.setFont('helvetica', 'normal');
                    doc.text(value, 70, yPos);
                    yPos += 7;
                });

                // Add LED count per character
                yPos += 5;
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('LED Count per Character:', 20, yPos);
                yPos += 7;

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                for (const char of this.state.currentText) {
                    if (char !== ' ') {
                        const ledCount = this.state.ledCountPerChar[char] || parseInt(document.getElementById('ledCount').value);
                        doc.text(`${char}: ${ledCount} LEDs`, 25, yPos);
                        yPos += 6;
                    }
                }

                // Save PDF
                doc.save(filename);
            };

            img.onerror = () => {
                alert('Error generating PDF. SVG conversion failed.');
            };

            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        } else {
            alert('No SVG to export. Please populate text first.');
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.ledConfigurator = new LEDConfigurator();
});