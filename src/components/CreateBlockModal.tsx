import React, { useState, useRef, useMemo } from 'react';
import {
  BlockNode,
  Port,
  PortSide,
  PortDataType,
  PortPlacementMode,
  PortType,
  BlockShape,
  ImageFitMode,
} from '../types';
import {
  X,
  Plus,
  Trash2,
  Cpu,
  Image as ImageIcon,
  Layers,
  Sparkles,
  Upload,
  Sliders,
  Check,
  Zap,
  Radio,
  Server,
  Database,
  Eye,
  Camera,
  Activity,
  HardDrive,
  Copy,
  Lock,
  Shield,
  Maximize2,
  AlertTriangle,
} from 'lucide-react';
import {
  calculateMinimumBlockSize,
  getPortCoordinatesAccurate,
  applyBlockAutoSizing,
  findDeterministicFreeSlot,
} from '../algorithms/blockGeometry';

export interface CreateBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlock: (block: BlockNode) => void;
  initialTemplate?: Partial<BlockNode>;
  existingNodes?: BlockNode[];
}

export interface PresetGraphic {
  id: string;
  name: string;
  category: string;
  dataUrl: string;
  defaultTitle: string;
  defaultSubtitle: string;
  defaultColor: string;
  defaultWidth: number;
  defaultHeight: number;
  shape: BlockShape;
  defaultInputs: { name: string; side: PortSide; type: PortDataType; mode?: PortPlacementMode; pos?: number; pinNumber?: number }[];
  defaultOutputs: { name: string; side: PortSide; type: PortDataType; mode?: PortPlacementMode; pos?: number; pinNumber?: number }[];
}

const PRESET_GRAPHICS: PresetGraphic[] = [
  {
    id: 'mcu_stm32',
    name: 'STM32 / SoC Microcontroller',
    category: 'Микроэлектроника & EDA',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="none"><rect width="200" height="140" rx="8" fill="%230f172a"/><rect x="15" y="15" width="170" height="110" rx="6" fill="%231e293b" stroke="%2338bdf8" stroke-width="1.5"/><circle cx="28" cy="28" r="4" fill="%23f43f5e"/><rect x="40" y="35" width="120" height="70" rx="4" fill="%23090d16" stroke="%230284c7" stroke-width="1"/><text x="100" y="65" fill="%23e2e8f0" font-size="11" font-weight="bold" font-family="monospace" text-anchor="middle">ARM Cortex-M7</text><text x="100" y="82" fill="%2338bdf8" font-size="9" font-family="monospace" text-anchor="middle">480MHz 2MB Flash</text><path d="M 50 115 L 150 115 M 50 120 L 150 120" stroke="%2364748b" stroke-width="1.5"/></svg>`,
    defaultTitle: 'STM32H7 Core SoC',
    defaultSubtitle: 'ARM Cortex-M7 @ 480MHz',
    defaultColor: '#38bdf8',
    defaultWidth: 220,
    defaultHeight: 150,
    shape: 'chip_ic',
    defaultInputs: [
      { name: 'VDD (3.3V)', side: 'top', type: 'power', mode: 'fixed', pos: 0.35, pinNumber: 1 },
      { name: 'GND (VSS)', side: 'top', type: 'power', mode: 'fixed', pos: 0.65, pinNumber: 2 },
      { name: 'ADC0 (Temp)', side: 'left', type: 'signal', mode: 'adaptive', pinNumber: 3 },
      { name: 'ADC1 (Volt)', side: 'left', type: 'signal', mode: 'adaptive', pinNumber: 4 },
      { name: 'NRST', side: 'bottom', type: 'control', mode: 'fixed', pos: 0.5, pinNumber: 5 },
    ],
    defaultOutputs: [
      { name: 'SPI_SCK', side: 'right', type: 'clock', mode: 'adaptive', pinNumber: 6 },
      { name: 'SPI_MOSI', side: 'right', type: 'bus', mode: 'adaptive', pinNumber: 7 },
      { name: 'UART_TX', side: 'right', type: 'signal', mode: 'adaptive', pinNumber: 8 },
    ],
  },
  {
    id: 'ai_neural_core',
    name: 'NPU / Neural Tensor Processor',
    category: 'Нейросети & AI',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="none"><rect width="200" height="140" rx="10" fill="%230d1117"/><rect x="12" y="12" width="176" height="116" rx="8" fill="%23161b22" stroke="%23a855f7" stroke-width="1.5"/><circle cx="50" cy="50" r="10" fill="%238b5cf6" opacity="0.6"/><circle cx="50" cy="90" r="10" fill="%238b5cf6" opacity="0.6"/><circle cx="100" cy="40" r="10" fill="%23ec4899" opacity="0.7"/><circle cx="100" cy="70" r="10" fill="%23ec4899" opacity="0.7"/><circle cx="100" cy="100" r="10" fill="%23ec4899" opacity="0.7"/><circle cx="150" cy="70" r="10" fill="%2306b6d4" opacity="0.8"/><line x1="50" y1="50" x2="100" y2="40" stroke="%23a855f7" stroke-width="1" opacity="0.5"/><line x1="50" y1="50" x2="100" y2="70" stroke="%23a855f7" stroke-width="1" opacity="0.5"/><line x1="50" y1="90" x2="100" y2="70" stroke="%23a855f7" stroke-width="1" opacity="0.5"/><line x1="50" y1="90" x2="100" y2="100" stroke="%23a855f7" stroke-width="1" opacity="0.5"/><line x1="100" y1="40" x2="150" y2="70" stroke="%23ec4899" stroke-width="1" opacity="0.5"/><line x1="100" y1="70" x2="150" y2="70" stroke="%23ec4899" stroke-width="1" opacity="0.5"/><line x1="100" y1="100" x2="150" y2="70" stroke="%23ec4899" stroke-width="1" opacity="0.5"/><text x="100" y="125" fill="%23c084fc" font-size="9.5" font-family="monospace" font-weight="bold" text-anchor="middle">32 TOPS Tensor Engine</text></svg>`,
    defaultTitle: 'NPU Tensor Core',
    defaultSubtitle: '32 TOPS Int8 Matrix Eng',
    defaultColor: '#a855f7',
    defaultWidth: 230,
    defaultHeight: 160,
    shape: 'rounded',
    defaultInputs: [
      { name: 'Weights Bus', side: 'top', type: 'bus', mode: 'fixed', pos: 0.5 },
      { name: 'Feature Map In', side: 'left', type: 'bus', mode: 'adaptive' },
      { name: 'Act Trigger', side: 'left', type: 'trigger', mode: 'adaptive' },
    ],
    defaultOutputs: [
      { name: 'Logits Out', side: 'right', type: 'bus', mode: 'adaptive' },
      { name: 'Loss / Grads', side: 'bottom', type: 'signal', mode: 'fixed', pos: 0.5 },
    ],
  },
  {
    id: 'fpga_matrix',
    name: 'Xilinx / Altera UltraScale FPGA',
    category: 'Микроэлектроника & EDA',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="none"><rect width="200" height="140" rx="6" fill="%2309090b"/><rect x="15" y="15" width="170" height="110" rx="4" fill="%2318181b" stroke="%23f59e0b" stroke-width="1.5"/><g stroke="%2371717a" stroke-width="0.75" opacity="0.4"><line x1="30" y1="30" x2="170" y2="30"/><line x1="30" y1="50" x2="170" y2="50"/><line x1="30" y1="70" x2="170" y2="70"/><line x1="30" y1="90" x2="170" y2="90"/><line x1="30" y1="110" x2="170" y2="110"/><line x1="50" y1="20" x2="50" y2="120"/><line x1="90" y1="20" x2="90" y2="120"/><line x1="130" y1="20" x2="130" y2="120"/></g><rect x="65" y="45" width="70" height="45" rx="3" fill="%2327272a" stroke="%23f59e0b" stroke-width="1"/><text x="100" y="68" fill="%23fbbf24" font-size="10" font-family="monospace" font-weight="bold" text-anchor="middle">Kintex-Ultra</text><text x="100" y="82" fill="%23a1a1aa" font-size="8" font-family="monospace" text-anchor="middle">500k LUT Matrix</text></svg>`,
    defaultTitle: 'UltraScale+ FPGA',
    defaultSubtitle: '500k Logic Cells Matrix',
    defaultColor: '#f59e0b',
    defaultWidth: 240,
    defaultHeight: 160,
    shape: 'chip_ic',
    defaultInputs: [
      { name: 'CLK_100M', side: 'top', type: 'clock', mode: 'fixed', pos: 0.3 },
      { name: 'VCCINT_0V85', side: 'top', type: 'power', mode: 'fixed', pos: 0.7 },
      { name: 'PCIe_RX_x8', side: 'left', type: 'bus', mode: 'adaptive' },
      { name: 'AXI_Slave', side: 'left', type: 'bus', mode: 'adaptive' },
    ],
    defaultOutputs: [
      { name: 'PCIe_TX_x8', side: 'right', type: 'bus', mode: 'adaptive' },
      { name: 'DDR4_PHY', side: 'bottom', type: 'bus', mode: 'adaptive' },
      { name: 'LVDS_Out', side: 'right', type: 'signal', mode: 'adaptive' },
    ],
  },
  {
    id: 'cmos_camera_sensor',
    name: 'CMOS Оптический Сенсор Камеры',
    category: 'Оптика & Датчики',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="none"><rect width="200" height="140" rx="8" fill="%23061325"/><circle cx="100" cy="70" r="48" fill="%230c2747" stroke="%2306b6d4" stroke-width="2"/><circle cx="100" cy="70" r="34" fill="%23083344" stroke="%2322d3ee" stroke-width="1.5"/><circle cx="100" cy="70" r="18" fill="%23164e63"/><circle cx="88" cy="58" r="6" fill="%2367e8f9" opacity="0.8"/><text x="100" y="128" fill="%2322d3ee" font-size="9" font-family="monospace" font-weight="bold" text-anchor="middle">4K HDR CMOS Sensor</text></svg>`,
    defaultTitle: '4K CMOS Sensor (Sony IMX)',
    defaultSubtitle: 'MIPI CSI-2 4-Lane Output',
    defaultColor: '#06b6d4',
    defaultWidth: 210,
    defaultHeight: 140,
    shape: 'rounded',
    defaultInputs: [
      { name: 'PWR_2V8', side: 'top', type: 'power', mode: 'fixed', pos: 0.5 },
      { name: 'I2C_CTRL', side: 'left', type: 'bus', mode: 'fixed', pos: 0.5 },
    ],
    defaultOutputs: [
      { name: 'MIPI_CLK', side: 'right', type: 'clock', mode: 'adaptive' },
      { name: 'MIPI_D0', side: 'right', type: 'bus', mode: 'adaptive' },
      { name: 'MIPI_D1', side: 'right', type: 'bus', mode: 'adaptive' },
      { name: 'FRAME_SYNC', side: 'bottom', type: 'trigger', mode: 'fixed', pos: 0.5 },
    ],
  },
  {
    id: 'db_storage_server',
    name: 'NVMe Кэш & База Данных',
    category: 'Хранение & Сеть',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="none"><rect width="200" height="140" rx="8" fill="%23111827"/><rect x="20" y="20" width="160" height="28" rx="5" fill="%231f2937" stroke="%2310b981" stroke-width="1.5"/><circle cx="35" cy="34" r="4" fill="%2310b981"/><circle cx="48" cy="34" r="4" fill="%2334d399"/><line x1="70" y1="34" x2="160" y2="34" stroke="%23374151" stroke-width="3" stroke-linecap="round"/><rect x="20" y="56" width="160" height="28" rx="5" fill="%231f2937" stroke="%2310b981" stroke-width="1.5"/><circle cx="35" cy="70" r="4" fill="%2310b981"/><circle cx="48" cy="70" r="4" fill="%2334d399"/><line x1="70" y1="70" x2="160" y2="70" stroke="%23374151" stroke-width="3" stroke-linecap="round"/><rect x="20" y="92" width="160" height="28" rx="5" fill="%231f2937" stroke="%2310b981" stroke-width="1.5"/><circle cx="35" cy="106" r="4" fill="%2310b981"/><circle cx="48" cy="106" r="4" fill="%2334d399"/><line x1="70" y1="106" x2="160" y2="106" stroke="%23374151" stroke-width="3" stroke-linecap="round"/></svg>`,
    defaultTitle: 'Distributed DB / Cache',
    defaultSubtitle: '10M IOPS NVMe Cluster',
    defaultColor: '#10b981',
    defaultWidth: 200,
    defaultHeight: 135,
    shape: 'rounded',
    defaultInputs: [
      { name: 'SQL Query In', side: 'left', type: 'bus', mode: 'adaptive' },
      { name: 'Replication Stream', side: 'top', type: 'bus', mode: 'fixed', pos: 0.5 },
    ],
    defaultOutputs: [
      { name: 'Recordset Out', side: 'right', type: 'bus', mode: 'adaptive' },
      { name: 'Cache Hit Rate', side: 'bottom', type: 'signal', mode: 'fixed', pos: 0.5 },
    ],
  },
];

export const CreateBlockModal: React.FC<CreateBlockModalProps> = ({
  isOpen,
  onClose,
  onCreateBlock,
  initialTemplate,
  existingNodes = [],
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'image'>('custom');
  const [customSubSection, setCustomSubSection] = useState<'identity' | 'appearance' | 'ports' | 'constraints'>('identity');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [title, setTitle] = useState(initialTemplate?.title || 'Новый Блок');
  const [subtitle, setSubtitle] = useState(initialTemplate?.subtitle || '');
  const [category, setCategory] = useState<BlockNode['category']>(initialTemplate?.category || 'processor');
  const [semanticType, setSemanticType] = useState<string>(initialTemplate?.semanticType || 'Core Module');
  const [description, setDescription] = useState<string>(initialTemplate?.description || '');
  const [color, setColor] = useState(initialTemplate?.color || '#3b82f6');
  const [width, setWidth] = useState(initialTemplate?.width || 180);
  const [height, setHeight] = useState(initialTemplate?.height || 110);
  const [shape, setShape] = useState<BlockShape>(initialTemplate?.shape || 'rounded');
  const [autoSize, setAutoSize] = useState<boolean>(initialTemplate?.autoSize ?? true);
  const [isPinned, setIsPinned] = useState<boolean>(initialTemplate?.isPinned ?? false);
  const [routingClearance, setRoutingClearance] = useState<number>(initialTemplate?.routingClearance || 15);
  const [preferredFlow, setPreferredFlow] = useState<string>(initialTemplate?.preferredFlow || 'left-to-right');

  // Custom Image State
  const [imageUrl, setImageUrl] = useState<string>(initialTemplate?.imageUrl || '');
  const [imageFit, setImageFit] = useState<ImageFitMode>(initialTemplate?.imageFit || 'contain');
  const [imageOpacity, setImageOpacity] = useState<number>(initialTemplate?.imageOpacity ?? 1.0);
  const [showTitleOverlay, setShowTitleOverlay] = useState<boolean>(initialTemplate?.showTitleOverlay ?? true);

  // Ports Configuration State
  const [ports, setPorts] = useState<Port[]>([
    {
      id: 'p_in_1',
      name: 'IN_A',
      type: 'input',
      side: 'left',
      placementMode: 'adaptive',
      relativePosition: 0.5,
      dataType: 'signal',
    },
    {
      id: 'p_out_1',
      name: 'OUT_RES',
      type: 'output',
      side: 'right',
      placementMode: 'adaptive',
      relativePosition: 0.5,
      dataType: 'signal',
    },
  ]);

  // Compute live minimum required dimensions (rule/2.md §8, §9)
  const minSize = useMemo(() => {
    return calculateMinimumBlockSize({
      title,
      subtitle,
      inputs: ports.filter(p => p.type === 'input' || p.type === 'inout' || p.type === 'passive'),
      outputs: ports.filter(p => p.type === 'output'),
      shape,
    });
  }, [title, subtitle, ports, shape]);

  const effectiveWidth = autoSize ? Math.max(minSize.minWidth, width) : Math.max(minSize.minWidth, width);
  const effectiveHeight = autoSize ? Math.max(minSize.minHeight, height) : Math.max(minSize.minHeight, height);

  // Mock block for live preview
  const previewNode = useMemo<BlockNode>(() => {
    return {
      id: 'preview_node',
      title: title.trim() || 'Блок',
      subtitle: subtitle.trim() || undefined,
      category,
      semanticType,
      x: 30,
      y: 30,
      width: effectiveWidth,
      height: effectiveHeight,
      inputs: ports.filter(p => p.type !== 'output'),
      outputs: ports.filter(p => p.type === 'output'),
      color,
      shape,
      imageUrl: imageUrl.trim() || undefined,
      imageFit: imageUrl.trim() ? imageFit : undefined,
      imageOpacity: imageUrl.trim() ? imageOpacity : undefined,
      showTitleOverlay,
      isPinned,
      autoSize,
    };
  }, [title, subtitle, category, semanticType, effectiveWidth, effectiveHeight, ports, color, shape, imageUrl, imageFit, imageOpacity, showTitleOverlay, isPinned, autoSize]);

  if (!isOpen) return null;

  // Handle Preset Graphic Selection
  const handleSelectPreset = (preset: PresetGraphic) => {
    setTitle(preset.defaultTitle);
    setSubtitle(preset.defaultSubtitle);
    setColor(preset.defaultColor);
    setWidth(preset.defaultWidth);
    setHeight(preset.defaultHeight);
    setShape(preset.shape);
    setImageUrl(preset.dataUrl);
    setImageFit('contain');
    setImageOpacity(1.0);
    setShowTitleOverlay(true);

    const newInputs: Port[] = preset.defaultInputs.map((p, idx) => ({
      id: `p_in_${Date.now()}_${idx}`,
      name: p.name,
      type: 'input',
      side: p.side,
      placementMode: p.mode || 'adaptive',
      relativePosition: p.pos ?? 0.5,
      dataType: p.type,
      pinNumber: p.pinNumber,
    }));

    const newOutputs: Port[] = preset.defaultOutputs.map((p, idx) => ({
      id: `p_out_${Date.now()}_${idx}`,
      name: p.name,
      type: 'output',
      side: p.side,
      placementMode: p.mode || 'adaptive',
      relativePosition: p.pos ?? 0.5,
      dataType: p.type,
      pinNumber: p.pinNumber,
    }));

    setPorts([...newInputs, ...newOutputs]);
    setActiveTab('custom');
  };

  // Add a new port
  const handleAddPort = (type: PortType, side: PortSide) => {
    const newId = `p_${Date.now().toString().slice(-6)}`;
    const count = ports.length + 1;
    const newPort: Port = {
      id: newId,
      name: `${type.toUpperCase()}_${count}`,
      type,
      side,
      placementMode: 'adaptive',
      relativePosition: 0.5,
      dataType: 'signal',
    };
    setPorts([...ports, newPort]);
  };

  const handleUpdatePort = (id: string, updates: Partial<Port>) => {
    setPorts(ports.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleDeletePort = (id: string) => {
    setPorts(ports.filter((p) => p.id !== id));
  };

  // Submit Block Creation deterministically (rule/2.md §2.5, §81)
  const handleCreate = () => {
    const newBlockId = `node_${Date.now().toString().slice(-6)}`;
    const inputs = ports.filter((p) => p.type !== 'output');
    const outputs = ports.filter((p) => p.type === 'output');

    const slot = findDeterministicFreeSlot(existingNodes, effectiveWidth, effectiveHeight);

    const rawBlock: BlockNode = {
      id: newBlockId,
      title: title.trim() || 'Новый Блок',
      subtitle: subtitle.trim() || undefined,
      category,
      semanticType: semanticType.trim() || undefined,
      description: description.trim() || undefined,
      x: slot.x,
      y: slot.y,
      width: effectiveWidth,
      height: effectiveHeight,
      inputs,
      outputs,
      color,
      shape,
      autoSize,
      minWidth: minSize.minWidth,
      minHeight: minSize.minHeight,
      imageUrl: imageUrl.trim() || undefined,
      imageFit: imageUrl.trim() ? imageFit : undefined,
      imageOpacity: imageUrl.trim() ? imageOpacity : undefined,
      showTitleOverlay,
      isPinned,
      routingClearance,
      preferredFlow: preferredFlow as any,
    };

    const finalBlock = applyBlockAutoSizing(rawBlock);
    onCreateBlock(finalBlock);
    onClose();
  };

  const colorPalette = [
    '#38bdf8', '#818cf8', '#a855f7', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f43f5e'
  ];

  return (
    <div
      id="create-block-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="create-block-modal-container"
        className="w-full max-w-5xl max-h-[92vh] bg-[#121418] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gray-200 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#0d0f12]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Конструктор Функциональных Блоков (AutoTrace Model)
              </h2>
              <p className="text-xs text-gray-400">
                Полное соответствие ТЗ: Identity → Appearance → Ports → Constraints → Auto Size
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Tab Switcher */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#16181e] border-b border-white/5 text-xs font-mono">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'custom'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Конструктор (4 Секции ТЗ)</span>
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'presets'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Библиотека EDA Шаблонов</span>
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'image'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Изображение / SVG Скин</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Min Size: {minSize.minWidth}×{minSize.minHeight}px</span>
          </div>
        </div>

        {/* Modal Body: Split into Form Controls + Live Interactive Preview */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Form Sections (7 cols) */}
          <div className="lg:col-span-7 overflow-y-auto p-5 space-y-4 border-r border-white/5">
            {activeTab === 'custom' && (
              <div className="space-y-4">
                {/* 4 Sections Sub-navigation (rule/2.md §68) */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-[#0a0c10] border border-white/10 rounded-xl text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setCustomSubSection('identity')}
                    className={`py-1.5 rounded-lg font-semibold transition-all ${
                      customSubSection === 'identity'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    1. Identity
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomSubSection('appearance')}
                    className={`py-1.5 rounded-lg font-semibold transition-all ${
                      customSubSection === 'appearance'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    2. Appearance
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomSubSection('ports')}
                    className={`py-1.5 rounded-lg font-semibold transition-all ${
                      customSubSection === 'ports'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    3. Ports ({ports.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomSubSection('constraints')}
                    className={`py-1.5 rounded-lg font-semibold transition-all ${
                      customSubSection === 'constraints'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    4. Constraints
                  </button>
                </div>

                {/* SECTION 1: IDENTITY (rule/2.md §69) */}
                {customSubSection === 'identity' && (
                  <div className="space-y-3 bg-[#0d0f14] p-4 rounded-xl border border-white/5 animate-fade-in">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-blue-400 font-bold flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>1. Идентификация и Семантика Блока (Identity)</span>
                    </h3>

                    <div>
                      <label className="text-[10px] font-mono text-gray-400 block mb-1">Заголовок / Название (Title)</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#16181e] border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                        placeholder="Например: STM32 Microcontroller Core"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono text-gray-400 block mb-1">Подзаголовок / Спецификация</label>
                        <input
                          type="text"
                          value={subtitle}
                          onChange={(e) => setSubtitle(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#16181e] border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                          placeholder="Например: ARM Cortex-M7 @ 480MHz"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-gray-400 block mb-1">Категория (Category)</label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value as BlockNode['category'])}
                          className="w-full px-3 py-1.5 bg-[#16181e] border border-white/10 rounded-lg text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
                        >
                          <option value="processor">Processor (Вычисления / CPU / NPU)</option>
                          <option value="logic">Logic (Логика / ПЛИС / АЛУ)</option>
                          <option value="source">Source (Источник / Сенсор)</option>
                          <option value="sink">Sink (Приёмник / Актюатор)</option>
                          <option value="storage">Storage (Память / NVMe / DB)</option>
                          <option value="custom">Custom (Пользовательский)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono text-gray-400 block mb-1">Семантический Тип (Semantic Type)</label>
                        <input
                          type="text"
                          value={semanticType}
                          onChange={(e) => setSemanticType(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#16181e] border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                          placeholder="IC / SoC / Module / Bus Router"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-gray-400 block mb-1">Описание (Description)</label>
                        <input
                          type="text"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#16181e] border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                          placeholder="Дополнительные инженерные заметки"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION 2: APPEARANCE (rule/2.md §70) */}
                {customSubSection === 'appearance' && (
                  <div className="space-y-3 bg-[#0d0f14] p-4 rounded-xl border border-white/5 animate-fade-in">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-purple-400 font-bold flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>2. Внешний Вид и Геометрия (Appearance)</span>
                    </h3>

                    {/* Shape selection (all 6 shapes) */}
                    <div>
                      <label className="text-[10px] font-mono text-gray-400 block mb-1.5">Форма Контура (Shape)</label>
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                        {[
                          { id: 'rounded', name: 'Rounded Box', desc: 'Радиус 12px' },
                          { id: 'rectangle', name: 'Rectangle', desc: 'Строгий 90°' },
                          { id: 'chip_ic', name: 'Chip IC', desc: 'Вырез & Ключ Pin 1' },
                          { id: 'circle', name: 'Circle', desc: 'Круг W=H' },
                          { id: 'diamond', name: 'Diamond', desc: 'Ромб ветвления' },
                          { id: 'hexagon', name: 'Hexagon', desc: 'Шестиугольник' },
                        ].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setShape(s.id as BlockShape)}
                            className={`p-2 rounded-xl border text-left transition-all ${
                              shape === s.id
                                ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm'
                                : 'bg-[#16181e] border-white/5 text-gray-400 hover:border-white/20'
                            }`}
                          >
                            <div className="font-bold text-[11px]">{s.name}</div>
                            <div className="text-[9px] text-gray-500">{s.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Auto Size toggle & dimension sliders */}
                    <div className="p-3 bg-[#16181e] rounded-xl border border-white/5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="auto-size-check"
                            checked={autoSize}
                            onChange={(e) => setAutoSize(e.target.checked)}
                            className="rounded accent-blue-500 cursor-pointer"
                          />
                          <label htmlFor="auto-size-check" className="text-xs font-mono font-bold text-white cursor-pointer">
                            Auto Size (Автоматический расчёт габаритов по портам)
                          </label>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400">Включён по умолчанию</span>
                      </div>

                      {width < minSize.minWidth || height < minSize.minHeight ? (
                        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-mono">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Блок автоматически увеличен до минимума ({minSize.minWidth}×{minSize.minHeight}px) для соблюдения шага портов 20px.</span>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-1">
                            <span>Ширина:</span>
                            <span className="text-blue-400 font-bold">{effectiveWidth} px</span>
                          </div>
                          <input
                            type="range"
                            min="120"
                            max="360"
                            step="10"
                            value={effectiveWidth}
                            onChange={(e) => setWidth(Number(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-1">
                            <span>Высота:</span>
                            <span className="text-blue-400 font-bold">{effectiveHeight} px</span>
                          </div>
                          <input
                            type="range"
                            min="72"
                            max="300"
                            step="10"
                            value={effectiveHeight}
                            onChange={(e) => setHeight(Number(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Image Skin & Overlay Controls */}
                    {imageUrl && (
                      <div className="p-3 bg-[#16181e] rounded-xl border border-white/5 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-gray-300 font-bold flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                            <span>Фоновый скин / Изображение</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setImageUrl('')}
                            className="text-[10px] text-rose-400 hover:underline"
                          >
                            Удалить скин
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                          <div>
                            <span className="text-gray-400 block mb-1">Режим масштабирования (Fit)</span>
                            <select
                              value={imageFit}
                              onChange={(e) => setImageFit(e.target.value as ImageFitMode)}
                              className="w-full px-2 py-1 bg-[#0a0c10] border border-white/10 rounded text-gray-200 focus:outline-none"
                            >
                              <option value="contain">Contain (Пропорционально)</option>
                              <option value="cover">Cover (Заполнить с обрезкой)</option>
                              <option value="fill">Fill (Растянуть)</option>
                            </select>
                          </div>

                          <div>
                            <div className="flex justify-between text-gray-400 mb-1">
                              <span>Прозрачность:</span>
                              <span className="text-blue-400 font-bold">{Math.round(imageOpacity * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0.1"
                              max="1.0"
                              step="0.05"
                              value={imageOpacity}
                              onChange={(e) => setImageOpacity(Number(e.target.value))}
                              className="w-full h-1.5 bg-white/10 rounded appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="chk-title-overlay-modal"
                            checked={showTitleOverlay}
                            onChange={(e) => setShowTitleOverlay(e.target.checked)}
                            className="rounded accent-blue-500 cursor-pointer"
                          />
                          <label htmlFor="chk-title-overlay-modal" className="text-[10px] font-mono text-gray-300 cursor-pointer">
                            Показывать заголовок поверх фонового изображения
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Color Accent */}
                    <div>
                      <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1.5">
                        Цветовой акцент
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {colorPalette.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={`w-6 h-6 rounded-full border transition-all ${
                              color === c
                                ? 'scale-125 border-white ring-2 ring-blue-400/40 shadow-lg'
                                : 'border-transparent hover:scale-110'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION 3: PORTS (rule/2.md §71) */}
                {customSubSection === 'ports' && (
                  <div className="space-y-3 bg-[#0d0f14] p-4 rounded-xl border border-white/5 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h3 className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5" />
                        <span>3. Модель Портов ({ports.length})</span>
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddPort('input', 'left')}
                          className="px-2 py-1 bg-blue-500/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg text-[10px] font-mono flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+In</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddPort('output', 'right')}
                          className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-[10px] font-mono flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+Out</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddPort('inout', 'left')}
                          className="px-2 py-1 bg-teal-500/20 hover:bg-teal-600 text-teal-300 hover:text-white rounded-lg text-[10px] font-mono flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+InOut</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {ports.map((port, idx) => {
                        const isFixed = port.placementMode === 'fixed';

                        return (
                          <div
                            key={port.id}
                            className="p-2.5 bg-[#16181e] border border-white/5 rounded-xl space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-1">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    port.type === 'output' ? 'bg-sky-400' : port.type === 'inout' ? 'bg-teal-400' : 'bg-blue-400'
                                  }`}
                                />
                                <input
                                  type="text"
                                  value={port.name}
                                  onChange={(e) => handleUpdatePort(port.id, { name: e.target.value })}
                                  className="px-2 py-0.5 bg-[#0a0c10] border border-white/10 rounded text-[11px] font-mono text-white w-full focus:outline-none focus:border-blue-500"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdatePort(port.id, {
                                    placementMode: isFixed ? 'adaptive' : 'fixed',
                                  })
                                }
                                className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-all ${
                                  isFixed
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                }`}
                              >
                                {isFixed ? '🔒 Fixed (Жёсткий)' : '⚡ Adaptive'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeletePort(port.id)}
                                className="p-1 text-gray-500 hover:text-rose-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                              <div>
                                <span className="text-gray-400 block mb-0.5">Грань (Side)</span>
                                <select
                                  value={port.side || (port.type === 'output' ? 'right' : 'left')}
                                  onChange={(e) =>
                                    handleUpdatePort(port.id, { side: e.target.value as PortSide })
                                  }
                                  className="w-full px-1.5 py-1 bg-[#0a0c10] border border-white/10 rounded text-[10px] text-gray-300 focus:outline-none"
                                >
                                  <option value="left">Left (Слева)</option>
                                  <option value="right">Right (Справа)</option>
                                  <option value="top">Top (Сверху)</option>
                                  <option value="bottom">Bottom (Снизу)</option>
                                </select>
                              </div>

                              <div>
                                <span className="text-gray-400 block mb-0.5">Тип Данных</span>
                                <select
                                  value={port.dataType || 'signal'}
                                  onChange={(e) =>
                                    handleUpdatePort(port.id, { dataType: e.target.value as PortDataType })
                                  }
                                  className="w-full px-1.5 py-1 bg-[#0a0c10] border border-white/10 rounded text-[10px] text-gray-300 focus:outline-none"
                                >
                                  <option value="signal">Signal (Аналог/Цифра)</option>
                                  <option value="bus">Bus (Шина)</option>
                                  <option value="clock">Clock (Тактовый)</option>
                                  <option value="power">Power (Питание VCC/GND)</option>
                                  <option value="control">Control (Reset/CS)</option>
                                  <option value="trigger">Trigger (Импульс)</option>
                                  <option value="data">Data (Поток данных)</option>
                                  <option value="analog">Analog (Аналоговый)</option>
                                  <option value="ground">Ground (Земля)</option>
                                  <option value="network">Network (Сеть/Ethernet)</option>
                                </select>
                              </div>

                              <div>
                                <span className="text-gray-400 block mb-0.5">Направление</span>
                                <select
                                  value={port.type}
                                  onChange={(e) =>
                                    handleUpdatePort(port.id, { type: e.target.value as PortType })
                                  }
                                  className="w-full px-1.5 py-1 bg-[#0a0c10] border border-white/10 rounded text-[10px] text-gray-300 focus:outline-none"
                                >
                                  <option value="input">Input (Вход)</option>
                                  <option value="output">Output (Выход)</option>
                                  <option value="inout">InOut (Двунаправленный)</option>
                                  <option value="passive">Passive (Пассивный)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SECTION 4: CONSTRAINTS (rule/2.md §72) */}
                {customSubSection === 'constraints' && (
                  <div className="space-y-3 bg-[#0d0f14] p-4 rounded-xl border border-white/5 animate-fade-in text-xs font-mono">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      <span>4. Ограничения Трассировки (Constraints)</span>
                    </h3>

                    <div className="p-3 bg-[#16181e] rounded-xl border border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold">Заморозить координаты (Pinned Block):</span>
                        <input
                          type="checkbox"
                          checked={isPinned}
                          onChange={(e) => setIsPinned(e.target.checked)}
                          className="rounded accent-amber-500 cursor-pointer"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400">
                        При включении блок не сдвигается при оптимизациях (∇_X_pinned Φ(X) ≡ 0).
                      </p>
                    </div>

                    <div className="p-3 bg-[#16181e] rounded-xl border border-white/5 space-y-2">
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>Зазор безопасности (Routing Clearance):</span>
                        <span className="text-blue-400 font-bold">{routingClearance} px</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="30"
                        step="2"
                        value={routingClearance}
                        onChange={(e) => setRoutingClearance(Number(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PRESETS */}
            {activeTab === 'presets' && (
              <div className="space-y-3">
                <span className="text-xs font-mono uppercase text-gray-400 block">
                  Выберите шаблон для быстрой загрузки:
                </span>
                <div className="grid grid-cols-1 gap-2.5">
                  {PRESET_GRAPHICS.map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className="p-3 bg-[#16181e] border border-white/5 hover:border-blue-500/50 rounded-xl cursor-pointer transition-all hover:bg-white/[0.03] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-10 rounded-lg bg-cover bg-center border border-white/10 shrink-0"
                          style={{ backgroundImage: `url("${preset.dataUrl}")` }}
                        />
                        <div>
                          <div className="font-bold text-xs text-white">{preset.name}</div>
                          <div className="text-[10px] font-mono text-gray-400">{preset.defaultSubtitle}</div>
                        </div>
                      </div>
                      <button className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg text-xs font-mono">
                        Применить
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: IMAGE / SVG */}
            {activeTab === 'image' && (
              <div className="space-y-4">
                <div className="p-4 bg-[#16181e] border border-dashed border-white/20 rounded-xl text-center space-y-3">
                  <Upload className="w-8 h-8 text-blue-400 mx-auto" />
                  <div className="text-xs font-mono text-gray-300">
                    Загрузите PNG, SVG или WebP для фонового изображения блока
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        if (typeof ev.target?.result === 'string') {
                          setImageUrl(ev.target.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-mono"
                  >
                    Выбрать файл
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Interactive Preview (5 cols) (rule/2.md §73) */}
          <div className="lg:col-span-5 bg-[#0a0c10] p-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span>Live Preview (Точная геометрия)</span>
                </span>
                <span className="text-[10px] font-mono text-gray-500">{shape.toUpperCase()}</span>
              </div>

              {/* Render Preview SVG */}
              <div className="w-full h-56 bg-[#121418] border border-white/10 rounded-xl flex items-center justify-center p-4 overflow-hidden relative">
                <svg
                  width={effectiveWidth + 60}
                  height={effectiveHeight + 60}
                  viewBox={`0 0 ${effectiveWidth + 60} ${effectiveHeight + 60}`}
                  className="overflow-visible"
                >
                  <g transform="translate(30, 30)">
                    {/* Shape Outline */}
                    {shape === 'chip_ic' ? (
                      <path
                        d={`M 0 8 Q 0 0 8 0 L ${effectiveWidth / 2 - 10} 0 A 8 8 0 0 0 ${effectiveWidth / 2 + 10} 0 L ${effectiveWidth - 8} 0 Q ${effectiveWidth} 0 ${effectiveWidth} 8 L ${effectiveWidth} ${effectiveHeight - 8} Q ${effectiveWidth} ${effectiveHeight} ${effectiveWidth - 8} ${effectiveHeight} L 8 ${effectiveHeight} Q 0 ${effectiveHeight} 0 ${effectiveHeight - 8} Z`}
                        fill="#16181d"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                      />
                    ) : shape === 'rectangle' ? (
                      <rect
                        x="0"
                        y="0"
                        width={effectiveWidth}
                        height={effectiveHeight}
                        fill="#16181d"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                      />
                    ) : shape === 'circle' ? (
                      <circle
                        cx={effectiveWidth / 2}
                        cy={effectiveHeight / 2}
                        r={Math.min(effectiveWidth, effectiveHeight) / 2}
                        fill="#16181d"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                      />
                    ) : shape === 'diamond' ? (
                      <polygon
                        points={`${effectiveWidth / 2},0 ${effectiveWidth},${effectiveHeight / 2} ${effectiveWidth / 2},${effectiveHeight} 0,${effectiveHeight / 2}`}
                        fill="#16181d"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                      />
                    ) : shape === 'hexagon' ? (
                      <polygon
                        points={`${effectiveWidth * 0.16},0 ${effectiveWidth * 0.84},0 ${effectiveWidth},${effectiveHeight * 0.5} ${effectiveWidth * 0.84},${effectiveHeight} ${effectiveWidth * 0.16},${effectiveHeight} 0,${effectiveHeight * 0.5}`}
                        fill="#16181d"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                      />
                    ) : (
                      <rect
                        x="0"
                        y="0"
                        width={effectiveWidth}
                        height={effectiveHeight}
                        rx="12"
                        fill="#16181d"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* Background Image / Skin */}
                    {imageUrl && (
                      <image
                        href={imageUrl}
                        x="3"
                        y="3"
                        width={effectiveWidth - 6}
                        height={effectiveHeight - 6}
                        preserveAspectRatio={
                          imageFit === 'contain'
                            ? 'xMidYMid meet'
                            : imageFit === 'cover'
                            ? 'xMidYMid slice'
                            : 'none'
                        }
                        opacity={imageOpacity}
                        className="rounded-lg"
                      />
                    )}

                    {/* Header bar (or Overlay) */}
                    {(!imageUrl || showTitleOverlay) && (
                      <>
                        <path
                          d={`M 0 10 Q 0 0 10 0 L ${effectiveWidth - 10} 0 Q ${effectiveWidth} 0 ${effectiveWidth} 10 L ${effectiveWidth} 22 L 0 22 Z`}
                          fill={imageUrl ? 'rgba(15, 23, 42, 0.85)' : '#1e293b'}
                        />
                        <circle cx="10" cy="11" r="3" fill={color} />
                        <text x="18" y="14.5" fill="#ffffff" fontSize="9" fontWeight="600" fontFamily="sans-serif">
                          {title.length > 18 ? `${title.slice(0, 17)}…` : title}
                        </text>
                      </>
                    )}

                    {/* Subtitle */}
                    {subtitle && (!imageUrl || showTitleOverlay) && (
                      <text x="10" y={effectiveHeight - 8} fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
                        {subtitle}
                      </text>
                    )}

                    {/* Ports */}
                    {ports.map((p) => {
                      const pos = getPortCoordinatesAccurate(previewNode, p.id, p.type === 'output');
                      const localX = pos.x - previewNode.x;
                      const localY = pos.y - previewNode.y;
                      const isFixed = p.placementMode === 'fixed';

                      return (
                        <g key={p.id}>
                          {isFixed ? (
                            <rect
                              x={localX - 4.5}
                              y={localY - 4.5}
                              width="9"
                              height="9"
                              rx="1.5"
                              fill={p.type === 'output' ? '#38bdf8' : '#3b82f6'}
                              stroke="#0c0d10"
                              strokeWidth="1"
                            />
                          ) : (
                            <circle
                              cx={localX}
                              cy={localY}
                              r="4.5"
                              fill={p.type === 'output' ? '#38bdf8' : '#3b82f6'}
                              stroke="#0c0d10"
                              strokeWidth="1"
                            />
                          )}
                          <text
                            x={pos.side === 'left' ? 10 : pos.side === 'right' ? effectiveWidth - 10 : localX}
                            y={pos.side === 'top' ? 30 : pos.side === 'bottom' ? effectiveHeight - 8 : localY + 3}
                            fill="#cbd5e1"
                            fontSize="7.5"
                            textAnchor={pos.side === 'left' ? 'start' : pos.side === 'right' ? 'end' : 'middle'}
                            fontFamily="monospace"
                          >
                            {p.name}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>

              {/* Geometry Specs summary */}
              <div className="p-3 bg-[#121418] rounded-xl border border-white/5 text-[10px] font-mono space-y-1 text-gray-400">
                <div className="flex justify-between">
                  <span>Расчётная площадь:</span>
                  <span className="text-white font-bold">{effectiveWidth * effectiveHeight} px²</span>
                </div>
                <div className="flex justify-between">
                  <span>Порты Left / Right:</span>
                  <span className="text-white">{ports.filter(p => p.side === 'left').length} / {ports.filter(p => p.side === 'right').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Порты Top / Bottom:</span>
                  <span className="text-white">{ports.filter(p => p.side === 'top').length} / {ports.filter(p => p.side === 'bottom').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Детерминированный слот:</span>
                  <span className="text-emerald-400">Spiral Scan (без коллизий)</span>
                </div>
              </div>
            </div>

            {/* Submit buttons */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-mono transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]"
              >
                <Check className="w-4 h-4" />
                <span>Создать Блок</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
