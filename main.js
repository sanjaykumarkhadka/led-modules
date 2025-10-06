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
            ledCountPerChar: {},
            currentTab: 'channel-letter',
            uploadedSVG: null,
            artworkElements: []
        };

        this.init();
    }

    applyInitialTabFromURL() {
        try {
            const params = new URLSearchParams(window.location.search);
            const tabParam = params.get('tab');
            if (!tabParam) return;

            const tabs = document.querySelectorAll('.tab');
            tabs.forEach(t => {
                const indicator = t.querySelector('.tab-indicator');
                t.classList.remove('tab-active');
                if (indicator) indicator.style.transform = 'scaleX(0)';
            });

            const target = document.querySelector(`.tab[data-tab="${tabParam}"]`);
            if (target) {
                target.classList.add('tab-active');
                const indicator = target.querySelector('.tab-indicator');
                if (indicator) indicator.style.transform = 'scaleX(1)';
                this.state.currentTab = tabParam;
                this.switchTabContent(tabParam);
            }
        } catch (e) {
            console.warn('Failed to apply initial tab from URL:', e);
        }
    }

    async init() {
        await this.loadFont();
        this.attachEventListeners();
        this.setupInitialState();
        this.applyInitialTabFromURL();
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
                    await this.renderText();
                }
            });
        }

        // Tab switching
        this.attachTabListeners();

        // Custom Artwork handlers
        this.attachCustomArtworkListeners();

        // Document-wide drag events
        document.addEventListener('mousemove', (e) => this.dragElement(e));
        document.addEventListener('mouseup', () => this.stopDragging());
    }

    attachCustomArtworkListeners() {
        const dropZone = document.getElementById('dropZone');
        const browseBtn = document.getElementById('browseBtn');
        const artworkFile = document.getElementById('artworkFile');
        const removeFile = document.getElementById('removeFile');
        const populateArtworkBtn = document.getElementById('populateArtworkBtn');
        const clearArtworkBtn = document.getElementById('clearArtworkBtn');
        const artworkModeRadios = document.querySelectorAll('input[name="artworkMode"]');
        const fileUploadMode = document.getElementById('fileUploadMode');
        const textInputMode = document.getElementById('textInputMode');
        const artworkText = document.getElementById('artworkText');

        // Mode switching
        artworkModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const mode = e.target.value;
                if (mode === 'file') {
                    fileUploadMode.classList.remove('hidden');
                    textInputMode.classList.add('hidden');
                    // Enable populate button if file is uploaded
                    if (populateArtworkBtn) {
                        populateArtworkBtn.disabled = !this.state.uploadedSVG && !this.state.uploadedPDF;
                    }
                } else if (mode === 'text') {
                    fileUploadMode.classList.add('hidden');
                    textInputMode.classList.remove('hidden');
                    // Enable populate button if text is entered
                    if (populateArtworkBtn && artworkText) {
                        populateArtworkBtn.disabled = artworkText.value.trim() === '';
                    }
                }
            });
        });

        // Text input change - enable populate button
        if (artworkText) {
            artworkText.addEventListener('input', () => {
                const selectedMode = document.querySelector('input[name="artworkMode"]:checked')?.value;
                if (selectedMode === 'text' && populateArtworkBtn) {
                    populateArtworkBtn.disabled = artworkText.value.trim() === '';
                }
            });
        }

        // Browse button
        if (browseBtn && artworkFile) {
            browseBtn.addEventListener('click', () => artworkFile.click());
        }

        // File input change
        if (artworkFile) {
            artworkFile.addEventListener('change', (e) => this.handleArtworkUpload(e.target.files[0]));
        }

        // Drag and drop
        if (dropZone) {
            dropZone.addEventListener('click', () => artworkFile.click());
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-blue-500', 'bg-blue-50');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('border-blue-500', 'bg-blue-50');
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-blue-500', 'bg-blue-50');
                const file = e.dataTransfer.files[0];
                if (file && file.type === 'image/svg+xml') {
                    this.handleArtworkUpload(file);
                }
            });
        }

        // Remove file
        if (removeFile) {
            removeFile.addEventListener('click', () => this.clearArtworkUpload());
        }

        // Populate artwork
        if (populateArtworkBtn) {
            populateArtworkBtn.addEventListener('click', () => this.renderCustomArtwork());
        }

        // Clear artwork
        if (clearArtworkBtn) {
            clearArtworkBtn.addEventListener('click', () => {
                this.clearArtworkUpload();
                if (artworkText) artworkText.value = '';
                if (populateArtworkBtn) populateArtworkBtn.disabled = true;
                this.clearCanvas();
            });
        }
    }

    handleArtworkUpload(file) {
        if (!file) return;

        const validTypes = ['application/pdf', 'application/postscript', 'image/svg+xml'];
        const validExtensions = ['.pdf', '.eps', '.svg'];
        const fileName = file.name.toLowerCase();
        const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

        if (!validTypes.includes(file.type) && !hasValidExtension) {
            alert('Please upload a valid PDF, EPS, or SVG file');
            return;
        }

        this.state.uploadedFile = file;
        this.state.uploadedFileType = fileName.endsWith('.pdf') ? 'pdf' :
                                       fileName.endsWith('.eps') ? 'eps' : 'svg';

        // Show file info
        const fileInfo = document.getElementById('fileInfo');
        const fileNameDisplay = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const populateBtn = document.getElementById('populateArtworkBtn');
        const manualConfig = document.getElementById('manualLEDConfig');

        if (fileInfo) fileInfo.classList.remove('hidden');
        if (fileNameDisplay) fileNameDisplay.textContent = file.name;
        if (fileSize) fileSize.textContent = `${(file.size / 1024).toFixed(2)} KB`;
        if (populateBtn) populateBtn.disabled = false;

        // Show manual LED config for PDF/EPS
        if (manualConfig) {
            if (this.state.uploadedFileType === 'pdf' || this.state.uploadedFileType === 'eps') {
                manualConfig.classList.remove('hidden');
            } else {
                manualConfig.classList.add('hidden');
            }
        }

        // For SVG, read text immediately
        if (this.state.uploadedFileType === 'svg') {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.state.uploadedSVG = e.target.result;
            };
            reader.readAsText(file);
        } else if (this.state.uploadedFileType === 'pdf') {
            // For PDF, read as array buffer
            const reader = new FileReader();
            reader.onload = (e) => {
                this.state.uploadedPDF = e.target.result;
            };
            reader.readAsArrayBuffer(file);
        }
    }

    clearArtworkUpload() {
        this.state.uploadedSVG = null;
        this.state.artworkElements = [];

        const fileInfo = document.getElementById('fileInfo');
        const artworkFile = document.getElementById('artworkFile');
        const populateBtn = document.getElementById('populateArtworkBtn');

        if (fileInfo) fileInfo.classList.add('hidden');
        if (artworkFile) artworkFile.value = '';
        if (populateBtn) populateBtn.disabled = true;
    }

    async renderCustomArtwork() {
        const loader = document.getElementById('loader');
        loader.style.display = 'block';

        try {
            // Check which mode is selected
            const selectedMode = document.querySelector('input[name="artworkMode"]:checked')?.value;

            if (selectedMode === 'text') {
                // Use text input mode - render with custom artwork dimensions
                const artworkText = document.getElementById('artworkText');
                if (artworkText && artworkText.value.trim()) {
                    await this.renderCustomArtworkText(artworkText.value);
                } else {
                    alert('Please enter some text to render.');
                }
            } else {
                // Use file upload mode
                if (this.state.uploadedFileType === 'pdf') {
                    await this.renderPDFArtwork();
                } else if (this.state.uploadedFileType === 'svg') {
                    await this.renderSVGArtwork();
                } else if (this.state.uploadedFileType === 'eps') {
                    alert('EPS files require conversion. Please convert to PDF or SVG first.');
                    loader.style.display = 'none';
                    return;
                }
            }
        } catch (error) {
            console.error('Error rendering artwork:', error);
            alert('Error processing file. Please try a different file.');
        }

        loader.style.display = 'none';
    }

    async renderCustomArtworkText(text) {
        // Get custom artwork configuration
        const artworkHeight = parseFloat(document.getElementById('artworkHeight')?.value || 35);
        const artworkWidth = parseFloat(document.getElementById('artworkWidth')?.value || 25);
        const artworkLedLines = parseInt(document.getElementById('artworkLedLines')?.value || 5);
        const artworkLedCountOverride = document.getElementById('artworkLedCount')?.value;

        // Calculate LED count - use override if provided, otherwise calculate
        let totalLedsPerChar;
        if (artworkLedCountOverride && artworkLedCountOverride.trim() !== '') {
            // Use direct override value
            totalLedsPerChar = parseInt(artworkLedCountOverride);
        } else {
            // Calculate based on LED lines and letter dimensions
            const ledsPerLine = Math.ceil(artworkHeight / 5); // Approximately 1 LED per 5 units of height
            totalLedsPerChar = artworkLedLines * ledsPerLine;
        }

        // Store original values
        const originalHeight = document.getElementById('height')?.value;
        const originalLedCount = document.getElementById('ledCount')?.value;
        const originalText = document.getElementById('yourText')?.value;

        // Temporarily set values for rendering
        if (document.getElementById('height')) {
            document.getElementById('height').value = artworkHeight;
        }
        if (document.getElementById('ledCount')) {
            document.getElementById('ledCount').value = totalLedsPerChar;
        }
        if (document.getElementById('yourText')) {
            document.getElementById('yourText').value = text;
        }

        // Render using the standard renderText method
        await this.renderText();

        // Add custom annotations for width and LED lines count
        this.addCustomArtworkAnnotations(artworkWidth, artworkLedLines);

        // Restore original values
        if (document.getElementById('height') && originalHeight) {
            document.getElementById('height').value = originalHeight;
        }
        if (document.getElementById('ledCount') && originalLedCount) {
            document.getElementById('ledCount').value = originalLedCount;
        }
        if (document.getElementById('yourText') && originalText) {
            document.getElementById('yourText').value = originalText;
        }
    }

    addCustomArtworkAnnotations(width, ledLines) {
        const svg = document.querySelector('#svgContainer svg');
        if (!svg) return;

        const svgNS = "http://www.w3.org/2000/svg";
        const mainGroup = svg.querySelector('g');
        if (!mainGroup) return;

        // Get unit
        const isMetric = document.getElementById('unitToggle')?.checked || false;
        const unit = isMetric ? 'mm' : 'in';
        const widthValue = isMetric ? (width * 25.4).toFixed(2) : width.toFixed(2);

        // Add width annotation for the first letter
        const firstCharGroup = mainGroup.querySelector('.char-group');
        if (firstCharGroup) {
            const bbox = firstCharGroup.getBBox();

            // Width annotation group
            const widthGroup = document.createElementNS(svgNS, "g");
            widthGroup.setAttribute("class", "width-annotation");

            // Top horizontal line
            const topLine = document.createElementNS(svgNS, "line");
            topLine.setAttribute("x1", bbox.x);
            topLine.setAttribute("y1", bbox.y - 30);
            topLine.setAttribute("x2", bbox.x + bbox.width);
            topLine.setAttribute("y2", bbox.y - 30);
            topLine.setAttribute("stroke", "#333");
            topLine.setAttribute("stroke-width", "2");
            widthGroup.appendChild(topLine);

            // Left tick
            const leftTick = document.createElementNS(svgNS, "line");
            leftTick.setAttribute("x1", bbox.x);
            leftTick.setAttribute("y1", bbox.y - 35);
            leftTick.setAttribute("x2", bbox.x);
            leftTick.setAttribute("y2", bbox.y - 25);
            leftTick.setAttribute("stroke", "#333");
            leftTick.setAttribute("stroke-width", "2");
            widthGroup.appendChild(leftTick);

            // Right tick
            const rightTick = document.createElementNS(svgNS, "line");
            rightTick.setAttribute("x1", bbox.x + bbox.width);
            rightTick.setAttribute("y1", bbox.y - 35);
            rightTick.setAttribute("x2", bbox.x + bbox.width);
            rightTick.setAttribute("y2", bbox.y - 25);
            rightTick.setAttribute("stroke", "#333");
            rightTick.setAttribute("stroke-width", "2");
            widthGroup.appendChild(rightTick);

            // Width text
            const widthText = document.createElementNS(svgNS, "text");
            widthText.setAttribute("x", bbox.x + bbox.width / 2);
            widthText.setAttribute("y", bbox.y - 35);
            widthText.setAttribute("text-anchor", "middle");
            widthText.setAttribute("font-size", "16");
            widthText.setAttribute("font-family", "Arial, sans-serif");
            widthText.setAttribute("fill", "#333");
            widthText.textContent = `${widthValue} ${unit}`;
            widthGroup.appendChild(widthText);

            mainGroup.appendChild(widthGroup);
        }
    }

    async renderPDFArtwork() {
        if (!this.state.uploadedPDF) return;

        const svgContainer = document.getElementById('svgContainer');
        svgContainer.innerHTML = '';

        // Get manual configuration
        const numElements = parseInt(document.getElementById('numElements').value) || 1;
        const ledsPerElement = parseInt(document.getElementById('ledsPerElement').value) || 50;
        const elementNamesInput = document.getElementById('elementNames').value;
        const elementNames = elementNamesInput ? elementNamesInput.split(',').map(n => n.trim()) : [];

        // Configure PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // Load PDF
        const loadingTask = pdfjsLib.getDocument({data: this.state.uploadedPDF});
        const pdf = await loadingTask.promise;

        // Get first page
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({scale: 1.5});

        // Create canvas to render PDF
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Render PDF page to canvas
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // Convert canvas to image and display
        const imgData = canvas.toDataURL('image/png');
        const img = document.createElement('img');
        img.src = imgData;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.border = '2px solid #e5e7eb';
        img.style.borderRadius = '8px';
        svgContainer.appendChild(img);

        // Create Manubhai-style breakdown table
        this.createArtworkBreakdown(numElements, ledsPerElement, elementNames);

        // Calculate totals
        const totalLEDs = numElements * ledsPerElement;
        this.calculateCustomArtworkResults(totalLEDs, numElements, ledsPerElement);
    }

    async renderSVGArtwork() {
        if (!this.state.uploadedSVG) return;

        // Clear and setup SVG
        const svgContainer = document.getElementById('svgContainer');
        svgContainer.innerHTML = '';

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

        // Parse uploaded SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(this.state.uploadedSVG, 'image/svg+xml');
        const uploadedSvg = svgDoc.documentElement;

        // Create main group
        const mainGroup = document.createElementNS(svgNS, "g");
        mainGroup.setAttribute("id", "mainGroup");

        // Get all path elements from uploaded SVG
        const paths = uploadedSvg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
        const ledCount = parseInt(document.getElementById('ledCount').value);
        const ledColor = document.getElementById('ledColor').value;

        this.state.artworkElements = [];
        let elementIndex = 0;

        // Process each shape
        paths.forEach((shape) => {
            const shapeGroup = document.createElementNS(svgNS, "g");
            shapeGroup.setAttribute("class", "artwork-element");
            shapeGroup.setAttribute("data-element", elementIndex);

            // Clone and add the shape outline
            const outline = shape.cloneNode(true);
            outline.setAttribute("class", "artwork-outline");
            outline.setAttribute("fill", "none");
            outline.setAttribute("stroke", document.getElementById('strokeColor').value);
            outline.setAttribute("stroke-width", document.getElementById('strokeWidth').value);
            shapeGroup.appendChild(outline);

            // Add fill
            const fill = shape.cloneNode(true);
            fill.setAttribute("class", "artwork-fill");
            fill.setAttribute("fill", "white");
            fill.setAttribute("stroke", "none");
            fill.setAttribute("opacity", "0");
            shapeGroup.appendChild(fill);

            mainGroup.appendChild(shapeGroup);

            // Store element info for LED placement
            this.state.artworkElements.push({
                element: outline,
                group: shapeGroup,
                ledCount: ledCount
            });

            elementIndex++;
        });

        svg.appendChild(mainGroup);
        svgContainer.appendChild(svg);

        // Calculate viewBox
        try {
            const bbox = mainGroup.getBBox();
            svg.setAttribute("viewBox",
                `${bbox.x - 20} ${bbox.y - 20} ${bbox.width + 40} ${bbox.height + 40}`);

            // Add dimensions annotations
            this.addArtworkDimensions(mainGroup, bbox);

            // Place LEDs on each element
            this.state.artworkElements.forEach((artworkEl, index) => {
                const outlinePath = artworkEl.element;
                const shapeGroup = artworkEl.group;

                if (outlinePath) {
                    this.ledPlacer.placeLEDsInside(outlinePath, shapeGroup, ledCount, {
                        color: ledColor,
                        brightness: 100,
                        effect: 'none'
                    });

                    // Add LED count display
                    const bbox = shapeGroup.getBBox();
                    const countText = document.createElementNS(svgNS, "text");
                    countText.setAttribute("x", bbox.x + bbox.width / 2);
                    countText.setAttribute("y", bbox.y + bbox.height + 25);
                    countText.setAttribute("text-anchor", "middle");
                    countText.setAttribute("font-size", "16");
                    countText.setAttribute("font-weight", "bold");
                    countText.setAttribute("fill", "#333");
                    countText.setAttribute("class", "led-count-display");
                    countText.textContent = `${ledCount} LEDs`;
                    shapeGroup.appendChild(countText);
                }
            });

            // Calculate total LEDs
            const totalLEDs = this.state.artworkElements.length * ledCount;
            this.calculateCustomArtworkResults(totalLEDs);

        } catch (error) {
            console.error('Error rendering artwork:', error);
        }

        loader.style.display = 'none';
    }

    addArtworkDimensions(mainGroup, bbox) {
        const svgNS = "http://www.w3.org/2000/svg";

        // Add width dimension (top)
        const widthLine = document.createElementNS(svgNS, "line");
        widthLine.setAttribute("x1", bbox.x);
        widthLine.setAttribute("y1", bbox.y - 30);
        widthLine.setAttribute("x2", bbox.x + bbox.width);
        widthLine.setAttribute("y2", bbox.y - 30);
        widthLine.setAttribute("stroke", "#333");
        widthLine.setAttribute("stroke-width", "2");
        widthLine.setAttribute("marker-start", "url(#arrowStart)");
        widthLine.setAttribute("marker-end", "url(#arrowEnd)");
        mainGroup.appendChild(widthLine);

        const widthText = document.createElementNS(svgNS, "text");
        widthText.setAttribute("x", bbox.x + bbox.width / 2);
        widthText.setAttribute("y", bbox.y - 35);
        widthText.setAttribute("text-anchor", "middle");
        widthText.setAttribute("font-size", "14");
        widthText.setAttribute("font-weight", "bold");
        widthText.setAttribute("fill", "#333");
        widthText.textContent = `${(bbox.width * 0.264583).toFixed(2)} mm`;
        mainGroup.appendChild(widthText);

        // Add height dimension (left)
        const heightLine = document.createElementNS(svgNS, "line");
        heightLine.setAttribute("x1", bbox.x - 30);
        heightLine.setAttribute("y1", bbox.y);
        heightLine.setAttribute("x2", bbox.x - 30);
        heightLine.setAttribute("y2", bbox.y + bbox.height);
        heightLine.setAttribute("stroke", "#333");
        heightLine.setAttribute("stroke-width", "2");
        mainGroup.appendChild(heightLine);

        const heightText = document.createElementNS(svgNS, "text");
        heightText.setAttribute("x", bbox.x - 40);
        heightText.setAttribute("y", bbox.y + bbox.height / 2);
        heightText.setAttribute("text-anchor", "end");
        heightText.setAttribute("dominant-baseline", "middle");
        heightText.setAttribute("font-size", "14");
        heightText.setAttribute("font-weight", "bold");
        heightText.setAttribute("fill", "#333");
        heightText.textContent = `${(bbox.height * 0.264583).toFixed(2)} mm`;
        mainGroup.appendChild(heightText);
    }

    createArtworkBreakdown(numElements, ledsPerElement, elementNames) {
        const svgContainer = document.getElementById('svgContainer');

        const breakdownDiv = document.createElement('div');
        breakdownDiv.className = 'mt-6 bg-white rounded-lg border border-gray-200 p-6';

        let html = '<h3 class="text-lg font-semibold mb-4 text-gray-800">LED Module Breakdown</h3>';
        html += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';

        for (let i = 0; i < numElements; i++) {
            const elementName = elementNames[i] || `Element ${i + 1}`;
            const totalModules = ledsPerElement;
            const selectedModule = CONFIG_DATA.modules[document.getElementById('module').value];
            const wattage = (totalModules * selectedModule.wattsPerModule).toFixed(1);

            html += `
                <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="font-semibold text-gray-700">${elementName}</h4>
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">#${i + 1}</span>
                    </div>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Total Modules:</span>
                            <span class="font-semibold text-gray-900">${totalModules}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Wattage:</span>
                            <span class="font-semibold text-gray-900">${wattage} W</span>
                        </div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        breakdownDiv.innerHTML = html;
        svgContainer.appendChild(breakdownDiv);
    }

    calculateCustomArtworkResults(totalLEDs, numElements = 1, ledsPerElement = 0) {
        const resultsPanel = document.getElementById('resultsPanel');
        if (!resultsPanel) return;

        resultsPanel.classList.remove('hidden');

        const selectedModule = CONFIG_DATA.modules[document.getElementById('module').value];
        const selectedPowerSupply = CONFIG_DATA.powerSupplies[document.getElementById('powerSupply').value];

        // Update module count
        document.getElementById('modulesCount').textContent = totalLEDs;

        // Calculate power
        const powerRequiredValue = totalLEDs * selectedModule.wattsPerModule;
        document.getElementById('powerRequired').textContent = `${powerRequiredValue.toFixed(1)} W`;

        // Calculate power supplies needed
        const powerSuppliesNeeded = Math.ceil(powerRequiredValue / selectedPowerSupply.maxWatts);
        document.getElementById('powerSuppliesCount').textContent = powerSuppliesNeeded;

        // Update stroke length with element info if available
        if (numElements > 1) {
            document.getElementById('strokeLength').textContent = `${numElements} elements`;
        }
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
                const tabName = tab.getAttribute('data-tab');

                // If user selects Cabinet, navigate to the dedicated Cabinet page
                if (tabName === 'cabinet') {
                    window.location.href = 'box.html';
                    return;
                }

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

                // Update current tab state
                this.state.currentTab = tabName;

                // Show/hide appropriate input sections
                this.switchTabContent(tabName);
            });
        });
    }

    switchTabContent(tabName) {
        // Hide all tab content
        const channelLetterInput = document.getElementById('channelLetterInput');
        const customArtworkInput = document.getElementById('customArtworkInput');

        if (channelLetterInput) channelLetterInput.classList.add('hidden');
        if (customArtworkInput) customArtworkInput.classList.add('hidden');

        // Show relevant content
        if (tabName === 'channel-letter' && channelLetterInput) {
            channelLetterInput.classList.remove('hidden');
        } else if (tabName === 'custom-artwork' && customArtworkInput) {
            customArtworkInput.classList.remove('hidden');
        }
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
                        <input type="number" id="charLedCount" value="${currentLedCount}" min="1" class="w-16 text-center border border-gray-300 rounded px-2 py-1">
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
            input.value = parseInt(input.value) + 1;
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

        if (!char || isNaN(newLedCount) || newLedCount < 1) {
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
            if (char === ' ' || char === '\n') continue;

            // Use per-character LED count if available, otherwise use default
            const charLedCount = this.state.ledCountPerChar[char] || defaultLedCount;
            totalModules += charLedCount;

            // Get perimeter - use characterData if available, otherwise calculate from rendered path
            if (CONFIG_DATA.characterData[char]) {
                const charData = CONFIG_DATA.characterData[char];
                totalPerimeter += charData.perimeter * letterHeightFeet;
            } else {
                // Calculate perimeter from actual rendered character
                const perimeter = this.getCharacterPerimeter(char, letterHeightFeet);
                totalPerimeter += perimeter;
            }
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

    getCharacterPerimeter(char, letterHeightFeet) {
        // Find the rendered character in the DOM
        const charGroups = document.querySelectorAll('.character-group');
        for (const charGroup of charGroups) {
            if (charGroup.getAttribute('data-char') === char) {
                const pathElement = charGroup.querySelector('.letter-outline');
                if (pathElement) {
                    try {
                        // Get the total length of the path (perimeter) in pixels
                        const pathLength = pathElement.getTotalLength();

                        // The path is rendered at fontSize (pixels), which represents letterHeightInches
                        const fontSize = CONFIG_DATA.defaults.fontSize; // 150 pixels
                        const letterHeightInches = parseFloat(document.getElementById('height').value);

                        // Convert path length to inches, then to feet
                        const perimeterInches = pathLength * (letterHeightInches / fontSize);
                        const perimeterFeet = perimeterInches / 12;

                        return perimeterFeet;
                    } catch (e) {
                        console.warn(`Could not calculate perimeter for character '${char}':`, e);
                    }
                }
            }
        }

        // Fallback: use average perimeter if character not found
        // Average perimeter is about 8 feet for a 1-foot tall letter
        return 8.0 * letterHeightFeet;
    }

    updateUnits() {
        const isMetric = document.getElementById('unitToggle').checked;
        const units = ['heightUnit', 'depthUnit', 'modulePitchUnit', 'artworkHeightUnit', 'artworkWidthUnit'];

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