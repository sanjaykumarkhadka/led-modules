import { useProjectStore } from './data/store';
import { CanvasStage } from './components/canvas/CanvasStage';
import { Button } from './components/ui/Button';
import { MODULE_CATALOG } from './data/catalog/modules';
import { SUPPORTED_LANGUAGES } from './data/languages';
import { generatePDFReport } from './utils/pdfReport';
import { ManualDesignerPage } from './components/editor/ManualDesignerPage';

function App() {
  const {
    blocks,
    depthInches,
    selectedModuleId,
    totalModules,
    totalPowerWatts,
    recommendedPSU,
    editorCharId,
    addBlock,
    updateBlock,
    removeBlock,
    setDepth,
    setModule,
    triggerPopulation,
    showDimensions,
    toggleDimensions,
    dimensionUnit,
    setDimensionUnit,
  } = useProjectStore();

  const currentModule = MODULE_CATALOG.find((m) => m.id === selectedModuleId);

  const handleGeneratePDF = async () => {
    if (!currentModule) {
      alert('Please select an LED module first');
      return;
    }

    // Get computed layout data from store
    const { computedLayoutData } = useProjectStore.getState();

    await generatePDFReport({
      blocks,
      totalModules,
      totalPowerWatts,
      depthInches,
      currentModule,
      recommendedPSU,
      blockCharPaths: computedLayoutData?.blockCharPaths,
      charLeds: computedLayoutData?.charLeds,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 font-sans text-slate-100">
      <header className="mb-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Qwatt LED Configurator
            </h1>
            <p className="text-slate-400 text-sm">Professional Channel Letter Signage Tool</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.print()}>
            Print Preview
          </Button>
          <Button onClick={handleGeneratePDF}>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export PDF
            </span>
          </Button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Controls (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50 space-y-6">
            <h2 className="font-bold text-lg text-white border-b border-slate-700 pb-3 flex justify-between items-center">
              <span>Configuration</span>
              <button
                onClick={addBlock}
                className="text-xs px-2 py-1 bg-blue-600 rounded text-white hover:bg-blue-500 transition-colors"
              >
                + Add Text
              </button>
            </h2>

            {/* Text Blocks List */}
            <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  className="p-3 bg-slate-900/50 rounded-xl border border-slate-700 relative group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase">
                      Line {index + 1}
                    </label>
                    <button
                      onClick={() => removeBlock(block.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                      title="Remove Line"
                      disabled={blocks.length === 1}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={block.text}
                      onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-bold"
                      placeholder="ENTER TEXT"
                    />

                    {/* Per-block Language Selector */}
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-medium">
                        Language / Script
                      </label>
                      <select
                        value={block.language}
                        onChange={(e) => updateBlock(block.id, { language: e.target.value })}
                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code} className="bg-slate-800">
                            {lang.name} ({lang.nativeName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase font-medium">
                          Height (px)
                        </label>
                        <input
                          type="number"
                          value={block.fontSize}
                          onChange={(e) =>
                            updateBlock(block.id, { fontSize: parseInt(e.target.value) || 100 })
                          }
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase font-medium">
                          Y Pos
                        </label>
                        <input
                          type="number"
                          value={block.y}
                          onChange={(e) =>
                            updateBlock(block.id, { y: parseInt(e.target.value) || 0 })
                          }
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-700">
              <Button
                onClick={triggerPopulation}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold shadow-lg shadow-green-500/20"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  AUTO POPULATE LEDs
                </span>
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Can Depth (Inches)</label>
              <input
                type="number"
                value={depthInches}
                step={0.5}
                min={1}
                max={12}
                onChange={(e) => setDepth(parseFloat(e.target.value))}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">LED Module</label>
              <select
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
                value={selectedModuleId}
                onChange={(e) => setModule(e.target.value)}
              >
                {MODULE_CATALOG.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-800">
                    {m.name} ({m.colorTemperature})
                  </option>
                ))}
              </select>
            </div>

            {/* Module Info Card */}
            {currentModule && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-2">
                <div className="text-xs text-blue-400 uppercase font-semibold tracking-wider">
                  Selected Module
                </div>
                <div className="text-white font-medium">{currentModule.name}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-slate-400">
                    Power: <span className="text-white">{currentModule.wattsPerModule}W</span>
                  </div>
                  <div className="text-slate-400">
                    Lumens: <span className="text-white">{currentModule.lumensPerModule}</span>
                  </div>
                  <div className="text-slate-400">
                    Spacing:{' '}
                    <span className="text-white">
                      {currentModule.installation.modulesPerFoot}/ft
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Voltage: <span className="text-white">{currentModule.voltage}V</span>
                  </div>
                </div>
              </div>
            )}

            {/* Dimension Controls */}
            <div className="space-y-3 pt-2 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">Show Dimensions</label>
                <button
                  onClick={toggleDimensions}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    showDimensions ? 'bg-blue-600' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      showDimensions ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {showDimensions && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Unit</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDimensionUnit('mm')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        dimensionUnit === 'mm'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Millimeters (mm)
                    </button>
                    <button
                      onClick={() => setDimensionUnit('in')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        dimensionUnit === 'in'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Inches (in)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results Panel */}
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-sm p-6 rounded-2xl border border-blue-500/30 space-y-4">
            <h2 className="font-bold text-lg text-white flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Engineering Results
            </h2>

            <div className="flex justify-between items-center py-3 border-b border-slate-600/50">
              <span className="text-slate-400">Total Modules</span>
              <span className="text-3xl font-bold text-white">{totalModules}</span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-slate-600/50">
              <span className="text-slate-400">Total Power</span>
              <span className="text-3xl font-bold text-blue-400">
                {totalPowerWatts.toFixed(1)} W
              </span>
            </div>

            <div className="pt-2">
              <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
                Recommended PSU
              </span>
              <div className="mt-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="font-semibold text-green-400">
                  {recommendedPSU ? recommendedPSU.name : 'Calculating...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Canvas (9 cols) */}
        <div className="lg:col-span-9 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden min-h-[600px] flex flex-col">
          <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/50 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
                <span>Canvas Preview</span>
              </div>
              <div className="h-4 w-px bg-slate-700"></div>
              <span className="text-xs text-slate-500 font-mono">Scale: 12.5px = 1"</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-slate-700/50 rounded-full text-xs text-slate-300 font-medium">
                {blocks.length} Lines
              </span>
              <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-xs text-blue-400 font-medium">
                {totalModules} LEDs
              </span>
            </div>
          </div>
          <div className="flex-1 relative">
            <CanvasStage />
          </div>
        </div>
      </main>

      {editorCharId && <ManualDesignerPage />}
    </div>
  );
}

export default App;
