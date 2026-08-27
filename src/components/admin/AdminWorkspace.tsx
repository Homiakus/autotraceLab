import React, { useState } from 'react';
import {
  X,
  Palette,
  Box,
  Share2,
  Shapes,
  Package,
  Layers,
  CheckCircle,
  Download,
  Upload,
  Plus,
} from 'lucide-react';
import { globalRegistryStore } from '../../registry/RegistryClient';
import { BlockTypeDefinition, ShapeDefinition, ThemeDefinition } from '../../registry/types';

interface AdminWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = 'appearance' | 'blockTypes' | 'shapes' | 'edgeTypes' | 'packages';

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('appearance');
  const [selectedBlockType, setSelectedBlockType] = useState<BlockTypeDefinition | null>(
    globalRegistryStore.getBlockType('core/block/process') || null
  );
  const [selectedShape, setSelectedShape] = useState<ShapeDefinition | null>(
    globalRegistryStore.getShape('core/shape/rectangle') || null
  );

  if (!isOpen) return null;

  const blockTypes = globalRegistryStore.getAllBlockTypes();
  const edgeTypes = globalRegistryStore.getAllEdgeTypes();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-6xl h-[88vh] bg-slate-900 border border-slate-700/70 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                AutoTrace Registry & Customization Workspace
                <span className="text-xs px-2 py-0.5 bg-indigo-900/60 text-indigo-300 rounded border border-indigo-700/50">
                  MP16 Customization Suite
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Declarative blueprints, theme tokens, shape envelopes, and versioned package administration.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-slate-800 bg-slate-900/80 gap-1 text-sm">
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-all ${
              activeTab === 'appearance'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-4 h-4" /> Appearance & Theme Tokens
          </button>
          <button
            onClick={() => setActiveTab('blockTypes')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-all ${
              activeTab === 'blockTypes'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-4 h-4" /> Block Types ({blockTypes.length})
          </button>
          <button
            onClick={() => setActiveTab('shapes')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-all ${
              activeTab === 'shapes'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shapes className="w-4 h-4" /> Shapes & Clearance Envelopes
          </button>
          <button
            onClick={() => setActiveTab('edgeTypes')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-all ${
              activeTab === 'edgeTypes'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Share2 className="w-4 h-4" /> Connection Styles
          </button>
          <button
            onClick={() => setActiveTab('packages')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-all ${
              activeTab === 'packages'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-4 h-4" /> Registry Packages
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950/40">
          {activeTab === 'appearance' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 p-5 bg-slate-900 border border-slate-800 rounded-xl">
                <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                  Theme Token Editor
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Canvas Background</label>
                    <input
                      type="text"
                      defaultValue="#0f172a"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Grid Color</label>
                    <input
                      type="text"
                      defaultValue="#1e293b"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Block Fill</label>
                    <input
                      type="text"
                      defaultValue="#1e293b"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Wire Default Accent</label>
                    <input
                      type="text"
                      defaultValue="#38bdf8"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-6 bg-slate-900 border border-slate-800 rounded-xl">
                <h4 className="text-xs font-semibold text-slate-400 uppercase mb-4">Live Preview</h4>
                <div className="w-full h-56 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <div className="w-36 h-20 bg-slate-800 border border-indigo-500/50 rounded-lg shadow-lg flex flex-col p-2 text-xs text-slate-200">
                    <span className="font-bold text-indigo-400">Process Block</span>
                    <span className="text-[10px] text-slate-400">Tokenized Preview</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'blockTypes' && (
            <div className="grid grid-cols-3 gap-6 h-full">
              <div className="col-span-1 border-r border-slate-800 pr-4 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Registered Blueprints</span>
                  <button className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs flex items-center gap-1">
                    <Plus className="w-3 h-3" /> New
                  </button>
                </div>
                {blockTypes.map(bt => (
                  <div
                    key={bt.id}
                    onClick={() => setSelectedBlockType(bt)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedBlockType?.id === bt.id
                        ? 'bg-indigo-950/40 border-indigo-500/80 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="font-medium text-sm">{bt.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{bt.id}</div>
                  </div>
                ))}
              </div>

              <div className="col-span-2 space-y-4">
                {selectedBlockType && (
                  <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white">{selectedBlockType.name}</h3>
                      <span className="text-xs px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800 rounded">
                        {selectedBlockType.status} v{selectedBlockType.version}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-1">Namespaced ID</span>
                        <input
                          disabled
                          value={selectedBlockType.id}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-slate-300"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">Shape ID</span>
                        <input
                          disabled
                          value={selectedBlockType.shapeId}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-slate-300"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">Default Width</span>
                        <input
                          disabled
                          value={selectedBlockType.defaultWidth}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-slate-300"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">Default Height</span>
                        <input
                          disabled
                          value={selectedBlockType.defaultHeight}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-slate-300"
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300 mb-2">Port Templates ({selectedBlockType.ports?.length || 0})</h4>
                      <div className="space-y-1.5">
                        {selectedBlockType.ports?.map(p => (
                          <div key={p.id} className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border border-slate-800/80 rounded text-xs">
                            <span className="font-mono text-indigo-400">{p.id} ({p.name})</span>
                            <span className="text-slate-400">{p.type} • side: {p.preferredSide || 'auto'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'shapes' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 uppercase">Dual Outline Shape & Clearance Preview</h3>
                <p className="text-xs text-slate-400">
                  The green outline represents the physical visual silhouette; the dashed yellow perimeter represents the computed routing obstacle clearance envelope.
                </p>
                <div className="w-full h-64 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center relative">
                  {/* Obstacle clearance box */}
                  <div className="w-56 h-36 border-2 border-dashed border-yellow-500/60 rounded-xl flex items-center justify-center">
                    {/* Visual block shape */}
                    <div className="w-40 h-24 bg-slate-800 border-2 border-emerald-500 rounded-lg shadow-lg flex items-center justify-center text-xs text-slate-200">
                      Visual Shape Outline
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase">Silhouette Parameters</h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Base Silhouette</label>
                    <select className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200">
                      <option value="rectangle">Rectangle</option>
                      <option value="rounded">Rounded Rectangle</option>
                      <option value="chip_ic">Chip IC Package</option>
                      <option value="circle">Circle</option>
                      <option value="diamond">Diamond</option>
                      <option value="hexagon">Hexagon</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Corner Radius (px)</label>
                    <input type="number" defaultValue={8} className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200" />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Obstacle Clearance Pad (px)</label>
                    <input type="number" defaultValue={12} className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'edgeTypes' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-200 uppercase">Connection Style Definitions</h3>
              <div className="grid grid-cols-2 gap-4">
                {edgeTypes.map(e => (
                  <div key={e.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{e.name}</span>
                      <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 rounded text-slate-300">{e.id}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded border border-slate-700" style={{ backgroundColor: e.color }} />
                      <span className="text-xs text-slate-400">Stroke: {e.strokeWidth}px • Head: {e.arrowHead || 'arrow'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'packages' && (
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Registry Packages</h3>
                  <p className="text-xs text-slate-400">Export and import complete domain vocabulary packages.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs flex items-center gap-1.5 border border-slate-700">
                    <Upload className="w-3.5 h-3.5" /> Import Package
                  </button>
                  <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Export Core Builtins
                  </button>
                </div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-indigo-400">core/package/builtin</span>
                  <span className="text-slate-400 ml-2">AutoTrace Core Builtins v1.0.0</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">Active</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400">
          <span>Active Registry Store: 1 Package, {blockTypes.length} Block Types, {edgeTypes.length} Edge Types</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
