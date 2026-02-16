// ui-components.js - UI component generation and management

class UIComponents {
  constructor() {
    this.initializeComponents();
  }

  initializeComponents() {
    this.loadConfigurationForm();
    this.loadToolbar();
    this.loadResultsPanel();
    this.loadEditorPanel();
    this.loadLEDControlPanel();
  }

  loadConfigurationForm() {
    const configForm = document.getElementById('configForm');
    if (!configForm) return;

    configForm.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- Layout Type -->
                <div>
                    <label for="layoutType" class="block text-sm font-medium mb-1">Layout Type</label>
                    <select id="layoutType" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                        <option>Face Lit</option>
                        <option>Back Lit</option>
                        <option>Halo Lit</option>
                    </select>
                </div>
                
                <!-- Voltage -->
                <div>
                    <label for="voltage" class="block text-sm font-medium mb-1">Voltage</label>
                    <select id="voltage" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                        <option>24V</option>
                        <option>12V</option>
                    </select>
                </div>
                
                <!-- Power Supply -->
                <div>
                    <label for="powerSupply" class="block text-sm font-medium mb-1">Power Supply</label>
                    <select id="powerSupply" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                        <option>GEPS24LT-100U-NA</option>
                        <option>GEPS12LT-100U-NA</option>
                        <option>GEPS24LT-60U-NA</option>
                    </select>
                </div>
                
                <!-- Font -->
                <div>
                    <label for="font" class="block text-sm font-medium mb-1">Font</label>
                    <select id="font" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                        <option>Roboto</option>
                        <option>Arial</option>
                    </select>
                </div>
                
                <!-- Series -->
                <div>
                    <label for="series" class="block text-sm font-medium mb-1">Series</label>
                    <select id="series" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                        <option>All</option>
                        <option>MAX Series</option>
                        <option>BASIC Series</option>
                    </select>
                </div>
                
                <!-- Power Supply Mode -->
                <div>
                    <label for="powerSupplyMode" class="block text-sm font-medium mb-1">Power Supply Mode</label>
                    <select id="powerSupplyMode" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                        <option>Simple Optimal</option>
                        <option>Advanced</option>
                        <option>Economy</option>
                    </select>
                </div>
                
                <!-- Height -->
                <div>
                    <label for="height" class="block text-sm font-medium mb-1">Height</label>
                    <div class="flex">
                        <input type="number" id="height" class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-blue-500 focus:border-blue-500" value="35">
                        <span class="inline-flex items-center px-3 text-sm text-gray-700 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg" id="heightUnit">in</span>
                    </div>
                </div>
                
                <!-- Color -->
                <div>
                    <label for="color" class="block text-sm font-medium mb-1">Color</label>
                    <select id="color" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                        <option>All</option>
                        <option>Red</option>
                        <option>Green</option>
                        <option>Blue</option>
                        <option>White</option>
                    </select>
                </div>
                
                <!-- Remote PS -->
                <div class="flex items-center">
                    <input type="checkbox" id="remotePS" class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                    <label for="remotePS" class="ml-2 text-sm font-medium">Remote PS</label>
                </div>
                
                <!-- Depth -->
                <div>
                    <label for="depth" class="block text-sm font-medium mb-1">Depth</label>
                    <div class="flex">
                        <input type="number" id="depth" class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-blue-500 focus:border-blue-500" value="5">
                        <span class="inline-flex items-center px-3 text-sm text-gray-700 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg" id="depthUnit">in</span>
                    </div>
                </div>
                
                <!-- Module -->
                <div>
                    <label for="module" class="block text-sm font-medium mb-1">Module</label>
                    <select id="module" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                        <option>Tetra MAX 24V Small 71K</option>
                        <option>Tetra MAX 24V Medium 71K</option>
                        <option>Tetra MAX 24V Large 71K</option>
                    </select>
                </div>
                
                <!-- Module Spacing -->
                <div>
                    <label for="modulePitch" class="block text-sm font-medium mb-1">Module Spacing</label>
                    <div class="flex">
                        <input type="number" id="modulePitch" class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-blue-500 focus:border-blue-500" value="8">
                        <span class="inline-flex items-center px-3 text-sm text-gray-700 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg" id="modulePitchUnit">in</span>
                    </div>
                </div>

                <!-- Stroke Spacing -->
                <div>
                    <label for="strokeSpacing" class="block text-sm font-medium mb-1">Stroke Spacing</label>
                    <div class="flex">
                        <input type="number" id="strokeSpacing" class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-blue-500 focus:border-blue-500" value="6" step="0.5">
                        <span class="inline-flex items-center px-3 text-sm text-gray-700 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg" id="strokeSpacingUnit">in</span>
                    </div>
                </div>
            </div>
        `;
  }

  loadToolbar() {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    toolbar.innerHTML = `
            <div class="flex flex-wrap gap-2">
                <button id="rotateLeft" class="tool-button w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100">
                    <i class="fas fa-undo-alt"></i>
                </button>
                <button id="rotateRight" class="tool-button w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100">
                    <i class="fas fa-redo-alt"></i>
                </button>
                <button id="moveUp" class="tool-button w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100">
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button id="moveDown" class="tool-button w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100">
                    <i class="fas fa-arrow-down"></i>
                </button>
                <button id="scaleUp" class="tool-button w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100">
                    <i class="fas fa-search-plus"></i>
                </button>
                <button id="scaleDown" class="tool-button w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100">
                    <i class="fas fa-search-minus"></i>
                </button>
                <button id="increaseLeds" class="tool-button w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100">
                    <i class="fas fa-plus-circle"></i>
                </button>
                <button id="decreaseLeds" class="tool-button w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100">
                    <i class="fas fa-minus-circle"></i>
                </button>
                <button id="clearCanvas" class="tool-button w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
  }

  loadResultsPanel() {
    const resultsPanel = document.getElementById('resultsPanel');
    if (!resultsPanel) return;

    resultsPanel.innerHTML = `
            <h3 class="text-lg font-semibold mb-4">Calculation Results</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="text-sm font-medium text-blue-500">LED Modules Required</div>
                    <div class="text-2xl font-bold" id="modulesCount">0</div>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="text-sm font-medium text-blue-500">Total Stroke Length</div>
                    <div class="text-2xl font-bold" id="strokeLength">0 in</div>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="text-sm font-medium text-blue-500">Power Required</div>
                    <div class="text-2xl font-bold" id="powerRequired">0 W</div>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="text-sm font-medium text-blue-500">Power Supplies Needed</div>
                    <div class="text-2xl font-bold" id="powerSuppliesCount">0</div>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="text-sm font-medium text-blue-500">Recommended Module Spacing</div>
                    <div class="text-2xl font-bold" id="recommendedSpacing">0 in</div>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="text-sm font-medium text-blue-500">Circuit Run Length</div>
                    <div class="text-2xl font-bold" id="circuitLength">0 in</div>
                </div>
            </div>
        `;
  }

  loadEditorPanel() {
    const editorPanel = document.getElementById('editorPanel');
    if (!editorPanel) return;

    editorPanel.innerHTML = `
            <h3 class="text-lg font-semibold mb-4 flex items-center">
                <i class="fas fa-sliders-h mr-2 text-blue-500"></i> Editor
            </h3>
            
            <div class="space-y-4">
                <!-- Stroke Color -->
                <div>
                    <label for="strokeColor" class="block text-sm font-medium mb-1">Stroke Color</label>
                    <div class="flex items-center">
                        <input type="color" id="strokeColor" value="#333333" class="w-10 h-10 border border-gray-300 rounded-lg cursor-pointer">
                        <span class="ml-2 text-sm" id="strokeColorValue">#333333</span>
                    </div>
                </div>
                
                <!-- Stroke Width -->
                <div>
                    <label for="strokeWidth" class="block text-sm font-medium mb-1">Stroke Width</label>
                    <input type="range" id="strokeWidth" min="1" max="10" value="3" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                    <div class="flex justify-between text-xs text-gray-500">
                        <span>1</span>
                        <span>3</span>
                        <span>5</span>
                        <span>7</span>
                        <span>10</span>
                    </div>
                </div>
                
                <!-- LED Color -->
                <div>
                    <label for="ledColor" class="block text-sm font-medium mb-1">LED Color</label>
                    <div class="flex items-center">
                        <input type="color" id="ledColor" value="#666666" class="w-10 h-10 border border-gray-300 rounded-lg cursor-pointer">
                        <span class="ml-2 text-sm" id="ledColorValue">#666666</span>
                    </div>
                </div>
                
                <!-- LED Count -->
                <div>
                    <label for="ledCount" class="block text-sm font-medium mb-1">LED Count per Character</label>
                    <div class="flex items-center">
                        <button id="decreaseLedCount" class="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-l-lg hover:bg-gray-100">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" id="ledCount" value="5" min="1" class="w-full h-8 text-center border-t border-b border-gray-300">
                        <button id="increaseLedCount" class="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-r-lg hover:bg-gray-100">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Character Library -->
            <div class="mt-8">
                <h3 class="text-lg font-semibold mb-4 flex items-center">
                    <i class="fas fa-font mr-2 text-blue-500"></i> Character Library
                </h3>
                <div class="grid grid-cols-4 gap-2">
                    ${this.generateCharacterLibrary()}
                </div>
            </div>
        `;
  }

  loadLEDControlPanel() {
    const ledControlPanel = document.getElementById('ledControlPanel');
    if (!ledControlPanel) return;

    ledControlPanel.innerHTML = `
            <h3 class="text-lg font-semibold mb-4 flex items-center">
                <i class="fas fa-lightbulb mr-2 text-yellow-500"></i> LED Control
            </h3>
            
            <div class="flex items-center mb-4">
                <div class="led-preview" id="ledPreview"></div>
                <input type="color" id="individualLedColor" value="#666666" class="w-10 h-10 border border-gray-300 rounded-lg cursor-pointer">
            </div>
            
            <div class="mb-4">
                <label for="ledBrightness" class="block text-sm font-medium mb-1">Brightness</label>
                <input type="range" id="ledBrightness" min="0" max="100" value="100" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                <div class="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                </div>
            </div>
            
            <div class="mb-4">
                <label for="ledEffect" class="block text-sm font-medium mb-1">Effect</label>
                <select id="ledEffect" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                    <option value="none">None</option>
                    <option value="blink">Blink</option>
                    <option value="pulse">Pulse</option>
                    <option value="chase">Chase</option>
                </select>
            </div>
            
            <div class="flex justify-between">
                <button id="applyToAllLeds" class="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">
                    Apply to All
                </button>
                <button id="applyToCharacterLeds" class="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">
                    Apply to Character
                </button>
            </div>
        `;
  }

  generateCharacterLibrary() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let html = '';
    for (let char of characters) {
      html += `<button class="character-card bg-gray-50 p-3 rounded-lg text-center font-bold hover:shadow transition cursor-pointer" data-char="${char}">${char}</button>`;
    }
    return html;
  }
}

// Export for use in other modules
window.UIComponents = UIComponents;
