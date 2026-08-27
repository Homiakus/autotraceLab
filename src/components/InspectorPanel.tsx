import React, { useRef } from 'react';
import {
  BlockNode,
  EdgeConnection,
  Port,
  PortSide,
  PortDataType,
  PortPlacementMode,
  BlockShape,
  ImageFitMode,
} from '../types';
import { calculateMinimumBlockSize } from '../algorithms/blockGeometry';
import {
  X,
  Plus,
  Trash2,
  Sliders,
  Tag,
  Palette,
  Move,
  Cpu,
  Image as ImageIcon,
  Upload,
  Copy,
  Lock,
  Zap,
  Sparkles,
  Layers,
  CornerUpRight,
  ArrowRightCircle,
} from 'lucide-react';

interface InspectorPanelProps {
  selectedNode: BlockNode | null;
  selectedEdge: EdgeConnection | null;
  onUpdateNode: (node: BlockNode) => void;
  onUpdateEdge: (edge: EdgeConnection) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onDuplicateNode?: (node: BlockNode) => void;
  onEnterSubcircuit?: (subcircuitId: string, nodeTitle?: string, parentNodeId?: string) => void;
  onClose: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
  onDuplicateNode,
  onEnterSubcircuit,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!selectedNode && !selectedEdge) return null;

  // Node editing handlers
  const handleAddPort = (type: 'input' | 'output', side: PortSide) => {
    if (!selectedNode) return;
    const newPortId = `p_${Date.now().toString().slice(-5)}`;
    const newPort: Port = {
      id: newPortId,
      name: `${type === 'output' ? 'OUT' : 'IN'}_${selectedNode.inputs.length + selectedNode.outputs.length + 1}`,
      type,
      side,
      placementMode: 'adaptive',
      relativePosition: 0.5,
      dataType: 'signal',
    };

    const updatedNode: BlockNode = {
      ...selectedNode,
      inputs: type === 'input' ? [...selectedNode.inputs, newPort] : selectedNode.inputs,
      outputs: type === 'output' ? [...selectedNode.outputs, newPort] : selectedNode.outputs,
    };

    onUpdateNode(updatedNode);
  };

  const handleUpdatePort = (portId: string, updates: Partial<Port>) => {
    if (!selectedNode) return;
    const updatePortList = (ports: Port[]) =>
      ports.map((p) => (p.id === portId ? { ...p, ...updates } : p));

    const updatedNode: BlockNode = {
      ...selectedNode,
      inputs: updatePortList(selectedNode.inputs),
      outputs: updatePortList(selectedNode.outputs),
    };

    onUpdateNode(updatedNode);
  };

  const handleDeletePort = (portId: string) => {
    if (!selectedNode) return;
    const updatedNode: BlockNode = {
      ...selectedNode,
      inputs: selectedNode.inputs.filter((p) => p.id !== portId),
      outputs: selectedNode.outputs.filter((p) => p.id !== portId),
    };
    onUpdateNode(updatedNode);
  };

  // Adapt all ports evenly
  const handleAdaptAllPorts = () => {
    if (!selectedNode) return;
    const adaptList = (ports: Port[]) =>
      ports.map((p) => ({ ...p, placementMode: 'adaptive' as PortPlacementMode }));
    onUpdateNode({
      ...selectedNode,
      inputs: adaptList(selectedNode.inputs),
      outputs: adaptList(selectedNode.outputs),
    });
  };

  // Lock all ports to fixed positions
  const handleLockAllPorts = () => {
    if (!selectedNode) return;
    const lockList = (ports: Port[]) =>
      ports.map((p) => ({
        ...p,
        placementMode: 'fixed' as PortPlacementMode,
        relativePosition: p.relativePosition ?? 0.5,
      }));
    onUpdateNode({
      ...selectedNode,
      inputs: lockList(selectedNode.inputs),
      outputs: lockList(selectedNode.outputs),
    });
  };

  // Handle Image File Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedNode) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        onUpdateNode({
          ...selectedNode,
          imageUrl: event.target.result,
          imageFit: selectedNode.imageFit || 'contain',
          imageOpacity: selectedNode.imageOpacity ?? 1.0,
          showTitleOverlay: selectedNode.showTitleOverlay ?? true,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const allNodePorts: Port[] = selectedNode
    ? [...selectedNode.inputs, ...selectedNode.outputs]
    : [];

  const dataTypes: { id: PortDataType; label: string; color: string }[] = [
    { id: 'signal', label: 'Signal', color: '#3b82f6' },
    { id: 'bus', label: 'Bus (Multi-bit)', color: '#8b5cf6' },
    { id: 'clock', label: 'Clock', color: '#10b981' },
    { id: 'power', label: 'Power / VCC', color: '#f59e0b' },
    { id: 'control', label: 'Control / RST', color: '#f43f5e' },
    { id: 'trigger', label: 'Trigger', color: '#ec4899' },
    { id: 'data', label: 'Data Stream', color: '#06b6d4' },
    { id: 'analog', label: 'Analog', color: '#eab308' },
    { id: 'ground', label: 'Ground (GND)', color: '#64748b' },
    { id: 'network', label: 'Network', color: '#a855f7' },
    { id: 'mechanical', label: 'Mechanical', color: '#78716c' },
    { id: 'custom', label: 'Custom', color: '#94a3b8' },
  ];

  const colorPalette = [
    '#38bdf8', '#818cf8', '#a855f7', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f43f5e', '#64748b'
  ];

  return (
    <div
      id="inspector-panel"
      className="absolute bottom-3 left-3 right-3 sm:bottom-auto sm:top-4 sm:right-4 sm:left-auto sm:w-88 max-h-[55vh] sm:max-h-[calc(100%-2rem)] overflow-y-auto bg-[#16181d]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-3.5 sm:p-4 flex flex-col gap-3.5 sm:gap-4 font-sans text-gray-200 z-30"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          {selectedNode ? (
            <>
              <Cpu className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-white">
                Инспектор Блока
              </span>
            </>
          ) : (
            <>
              <Tag className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-white">
                Инспектор Связи
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {selectedNode && onDuplicateNode && (
            <button
              onClick={() => onDuplicateNode(selectedNode)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Дублировать этот блок"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Закрыть панель"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* NODE INSPECTOR */}
      {selectedNode && (
        <div className="space-y-4 text-xs">
          {/* Node Title & Subtitle */}
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-mono uppercase text-gray-400 tracking-wider block mb-1">
                Название блока
              </label>
              <input
                type="text"
                value={selectedNode.title}
                onChange={(e) => onUpdateNode({ ...selectedNode, title: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-[#0c0d10] border border-white/10 rounded-lg text-white font-medium focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-gray-400 tracking-wider block mb-1">
                Подзаголовок / Описание
              </label>
              <input
                type="text"
                placeholder="Спецификация или модель..."
                value={selectedNode.subtitle || ''}
                onChange={(e) => onUpdateNode({ ...selectedNode, subtitle: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-[#0c0d10] border border-white/10 rounded-lg text-gray-300 focus:border-blue-500 focus:outline-none text-[11px]"
              />
            </div>
          </div>

          {/* Subcircuit Section (Подсхема) */}
          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-purple-300 font-bold font-mono text-[11px]">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>Многоуровневая Подсхема</span>
              </div>
              <label className="flex items-center gap-1 cursor-pointer text-[10px] text-gray-400">
                <input
                  type="checkbox"
                  checked={selectedNode.isSubcircuit ?? false}
                  onChange={(e) => onUpdateNode({ ...selectedNode, isSubcircuit: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-0 bg-[#0c0d10] border-white/20"
                />
                <span>Вкл</span>
              </label>
            </div>

            {selectedNode.isSubcircuit && (
              <div className="space-y-2 pt-1 border-t border-purple-500/20">
                {selectedNode.subcircuitSummary && (
                  <p className="text-[10px] text-purple-200/80 leading-relaxed font-mono">
                    {selectedNode.subcircuitSummary}
                  </p>
                )}
                {onEnterSubcircuit && (
                  <button
                    onClick={() => {
                      const subId = selectedNode.subcircuitId || `subcircuit_${selectedNode.id}`;
                      onEnterSubcircuit(subId, selectedNode.title, selectedNode.id);
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold font-mono text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    <span>Войти в подсхему</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Geometry Shape & Category */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono uppercase text-gray-400 tracking-wider block mb-1">
                Форма (Shape)
              </label>
              <select
                value={selectedNode.shape || 'rounded'}
                onChange={(e) => onUpdateNode({ ...selectedNode, shape: e.target.value as BlockShape })}
                className="w-full px-2 py-1.5 bg-[#0c0d10] border border-white/10 rounded-lg text-xs font-mono text-gray-300 focus:outline-none"
              >
                <option value="rounded">Скругленный Bento</option>
                <option value="chip_ic">Микросхема IC (Notch)</option>
                <option value="rectangle">Прямоугольник</option>
                <option value="hexagon">Шестиугольник</option>
                <option value="diamond">Ромб (Decision)</option>
                <option value="circle">Круг (Circle / Hub)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-gray-400 tracking-wider block mb-1">
                Категория
              </label>
              <select
                value={selectedNode.category}
                onChange={(e) => onUpdateNode({ ...selectedNode, category: e.target.value as BlockNode['category'] })}
                className="w-full px-2 py-1.5 bg-[#0c0d10] border border-white/10 rounded-lg text-xs font-mono text-gray-300 focus:outline-none"
              >
                <option value="processor">Процессор / SoC</option>
                <option value="source">Источник / Сенсор</option>
                <option value="sink">Приёмник / Вывод</option>
                <option value="logic">Логика / Gate</option>
                <option value="storage">Память / Кэш</option>
                <option value="custom">Пользовательский</option>
              </select>
            </div>
          </div>

          {/* Color & Size Controls */}
          {(() => {
            const minSize = calculateMinimumBlockSize(selectedNode);
            return (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-mono uppercase text-gray-400 tracking-wider">
                      Ширина ({selectedNode.width}px)
                    </label>
                    <span className="text-[9px] font-mono text-gray-500">мин: {minSize.minWidth}</span>
                  </div>
                  <input
                    type="range"
                    min={Math.min(100, minSize.minWidth)}
                    max="340"
                    step="10"
                    value={selectedNode.width}
                    onChange={(e) =>
                      onUpdateNode({
                        ...selectedNode,
                        width: Math.max(minSize.minWidth, Number(e.target.value)),
                      })
                    }
                    className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-mono uppercase text-gray-400 tracking-wider">
                      Высота ({selectedNode.height}px)
                    </label>
                    <span className="text-[9px] font-mono text-gray-500">мин: {minSize.minHeight}</span>
                  </div>
                  <input
                    type="range"
                    min={Math.min(60, minSize.minHeight)}
                    max="260"
                    step="10"
                    value={selectedNode.height}
                    onChange={(e) =>
                      onUpdateNode({
                        ...selectedNode,
                        height: Math.max(minSize.minHeight, Number(e.target.value)),
                      })
                    }
                    className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            );
          })()}

          {/* Accent Color Picker */}
          <div>
            <label className="text-[10px] font-mono uppercase text-gray-400 tracking-wider block mb-1.5">
              Цветовой акцент
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  onClick={() => onUpdateNode({ ...selectedNode, color })}
                  className={`w-5 h-5 rounded-full border transition-transform ${
                    selectedNode.color === color
                      ? 'scale-125 border-white ring-2 ring-white/20'
                      : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* IMAGE BLOCK SETTINGS */}
          <div className="p-3 bg-[#0c0d10] border border-white/5 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-gray-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>Изображение Блока</span>
              </span>
              {selectedNode.imageUrl && (
                <button
                  onClick={() =>
                    onUpdateNode({
                      ...selectedNode,
                      imageUrl: undefined,
                    })
                  }
                  className="text-[10px] font-mono text-rose-400 hover:underline"
                >
                  Удалить картинку
                </button>
              )}
            </div>

            {selectedNode.imageUrl ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded bg-black/50 border border-white/10 p-1 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img
                      src={selectedNode.imageUrl}
                      alt="Thumbnail"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-1 px-2 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-gray-300 flex items-center justify-center gap-1 transition-colors"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Заменить файл</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div>
                    <span className="text-gray-400 block mb-0.5">Fit Mode</span>
                    <select
                      value={selectedNode.imageFit || 'contain'}
                      onChange={(e) =>
                        onUpdateNode({ ...selectedNode, imageFit: e.target.value as ImageFitMode })
                      }
                      className="w-full px-1.5 py-1 bg-[#16181d] border border-white/10 rounded text-[10px] text-gray-300 focus:outline-none"
                    >
                      <option value="contain">Contain</option>
                      <option value="cover">Cover</option>
                      <option value="fill">Fill</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">
                      Прозрачность: {Math.round((selectedNode.imageOpacity ?? 1) * 100)}%
                    </span>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={selectedNode.imageOpacity ?? 1}
                      onChange={(e) =>
                        onUpdateNode({ ...selectedNode, imageOpacity: Number(e.target.value) })
                      }
                      className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-blue-500 mt-2"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="insp-chk-title-overlay"
                    checked={selectedNode.showTitleOverlay ?? true}
                    onChange={(e) =>
                      onUpdateNode({ ...selectedNode, showTitleOverlay: e.target.checked })
                    }
                    className="w-3.5 h-3.5 rounded border-white/10 bg-[#16181d] text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="insp-chk-title-overlay" className="text-[10px] text-gray-300 cursor-pointer">
                    Показывать заголовок поверх картинки
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-1.5 px-3 rounded-lg bg-blue-500/10 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/20 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Загрузить изображение для блока</span>
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* PORTS LIST & CONFIGURATION */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-gray-300 tracking-wider">
                Порты ({allNodePorts.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAddPort('input', 'left')}
                  className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-600 hover:text-white text-[10px] font-mono flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>+Вход</span>
                </button>
                <button
                  onClick={() => handleAddPort('output', 'right')}
                  className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-600 hover:text-white text-[10px] font-mono flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>+Выход</span>
                </button>
              </div>
            </div>

            {/* Batch mode switcher */}
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 bg-[#0c0d10] p-1.5 rounded-lg border border-white/5">
              <span>Пакетная настройка:</span>
              <div className="flex gap-2">
                <button
                  onClick={handleAdaptAllPorts}
                  className="text-blue-400 hover:underline"
                  title="Равномерно распределить все порты"
                >
                  ⚡ Адаптивные
                </button>
                <span>|</span>
                <button
                  onClick={handleLockAllPorts}
                  className="text-amber-400 hover:underline"
                  title="Зафиксировать все позиции"
                >
                  🔒 Зафиксировать
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {allNodePorts.map((port) => {
                const currentSide: PortSide = port.side || (port.type === 'output' ? 'right' : 'left');
                const isFixed = port.placementMode === 'fixed';
                const relPos = port.relativePosition !== undefined ? port.relativePosition : 0.5;

                return (
                  <div
                    key={port.id}
                    className="p-2.5 bg-[#0c0d10] border border-white/5 rounded-xl space-y-2"
                  >
                    {/* Port Name, Mode & Delete */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            port.type === 'output' ? 'bg-emerald-400' : 'bg-blue-400'
                          }`}
                        />
                        <input
                          type="text"
                          value={port.name}
                          onChange={(e) => handleUpdatePort(port.id, { name: e.target.value })}
                          className="px-1.5 py-0.5 bg-[#16181d] border border-white/10 rounded text-xs font-mono text-white w-full focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Fixed / Adaptive Toggle */}
                      <button
                        onClick={() =>
                          handleUpdatePort(port.id, {
                            placementMode: isFixed ? 'adaptive' : 'fixed',
                            relativePosition: port.relativePosition ?? 0.5,
                          })
                        }
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-all ${
                          isFixed
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        }`}
                        title={isFixed ? 'Жёстко заданный порт' : 'Адаптивный порт'}
                      >
                        {isFixed ? '🔒 Фикс' : '⚡ Адапт'}
                      </button>

                      <button
                        onClick={() => handleDeletePort(port.id)}
                        className="p-1 rounded hover:bg-rose-500/20 text-gray-500 hover:text-rose-400 transition-colors"
                        title="Удалить порт"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Side Face Selector & Data Type */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] font-mono text-gray-400 uppercase block mb-0.5">
                          Грань (Сторона)
                        </span>
                        <select
                          value={currentSide}
                          onChange={(e) =>
                            handleUpdatePort(port.id, { side: e.target.value as PortSide })
                          }
                          className="w-full px-1.5 py-0.5 bg-[#16181d] border border-white/10 rounded text-[11px] font-mono text-gray-300 focus:outline-none"
                        >
                          <option value="left">Left (Слева)</option>
                          <option value="right">Right (Справа)</option>
                          <option value="top">Top (Сверху)</option>
                          <option value="bottom">Bottom (Снизу)</option>
                        </select>
                      </div>

                      <div>
                        <span className="text-[9px] font-mono text-gray-400 uppercase block mb-0.5">
                          Тип данных
                        </span>
                        <select
                          value={port.dataType || 'signal'}
                          onChange={(e) =>
                            handleUpdatePort(port.id, { dataType: e.target.value as PortDataType })
                          }
                          className="w-full px-1.5 py-0.5 bg-[#16181d] border border-white/10 rounded text-[11px] font-mono text-gray-300 focus:outline-none"
                        >
                          {dataTypes.map((dt) => (
                            <option key={dt.id} value={dt.id}>
                              {dt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* If Fixed Mode: Position Slider */}
                    {isFixed && (
                      <div>
                        <div className="flex justify-between text-[9px] font-mono text-gray-400 mb-0.5">
                          <span>Фиксированная позиция:</span>
                          <span className="text-amber-400 font-bold">{Math.round(relPos * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="0.9"
                          step="0.05"
                          value={relPos}
                          onChange={(e) =>
                            handleUpdatePort(port.id, { relativePosition: Number(e.target.value) })
                          }
                          className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delete Node Button */}
          <div className="pt-2">
            <button
              onClick={() => onDeleteNode(selectedNode.id)}
              className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/20 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Удалить весь блок</span>
            </button>
          </div>
        </div>
      )}

      {/* EDGE INSPECTOR */}
      {selectedEdge && (
        <div className="space-y-4 text-xs">
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase text-gray-400 tracking-wider">
              Подпись стрелки / связи (Label)
            </label>
            <input
              type="text"
              placeholder="e.g. SPI_CLK 20MHz, Data Bus..."
              value={selectedEdge.label || ''}
              onChange={(e) => onUpdateEdge({ ...selectedEdge, label: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-[#0c0d10] border border-white/10 rounded-lg text-white font-medium focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-gray-400 tracking-wider block mb-1.5">
              Цвет линии связи
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  onClick={() => onUpdateEdge({ ...selectedEdge, color })}
                  className={`w-5 h-5 rounded-full border transition-transform ${
                    selectedEdge.color === color
                      ? 'scale-125 border-white ring-2 ring-white/20'
                      : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="p-3 bg-[#0c0d10] border border-white/5 rounded-xl text-[11px] font-mono text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Источник:</span>
              <span className="text-white font-semibold">
                {selectedEdge.sourceBlockId} ({selectedEdge.sourcePortId})
              </span>
            </div>
            <div className="flex justify-between">
              <span>Приёмник:</span>
              <span className="text-white font-semibold">
                {selectedEdge.targetBlockId} ({selectedEdge.targetPortId})
              </span>
            </div>
            {selectedEdge.path && (
              <div className="flex justify-between pt-1 border-t border-white/5">
                <span>Точек трассы:</span>
                <span className="text-blue-400 font-bold">{selectedEdge.path.length} сегментов</span>
              </div>
            )}
          </div>

          <button
            onClick={() => onDeleteEdge(selectedEdge.id)}
            className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/20 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Удалить связь</span>
          </button>
        </div>
      )}
    </div>
  );
};

