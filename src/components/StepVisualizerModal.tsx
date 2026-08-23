import React, { useState, useEffect } from 'react';
import { BlockNode, EdgeConnection, AlgorithmStep } from '../types';
import { runSugiyamaLayout } from '../algorithms/sugiyamaLayout';
import { routeOrthogonalAStar } from '../algorithms/orthogonalAStarRouter';
import { DEFAULT_OPTIMIZATION_WEIGHTS } from '../data/weightPresets';
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw, CheckCircle2, Layers, Cpu, ArrowRight } from 'lucide-react';

interface StepVisualizerModalProps {
  nodes: BlockNode[];
  edges: EdgeConnection[];
  customSteps?: AlgorithmStep[] | null;
  onApplyLayout: (nodes: BlockNode[], edges: EdgeConnection[]) => void;
  onClose: () => void;
}

export const StepVisualizerModal: React.FC<StepVisualizerModalProps> = ({
  nodes: initialNodes,
  edges: initialEdges,
  customSteps,
  onApplyLayout,
  onClose,
}) => {
  // Generate the steps
  const [stepsData, setStepsData] = useState<AlgorithmStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (customSteps && customSteps.length > 0) {
      setStepsData(customSteps);
      setCurrentStepIdx(0);
    } else {
      const sugiyama = runSugiyamaLayout(initialNodes, initialEdges);
      setStepsData(sugiyama.steps);
      setCurrentStepIdx(0);
    }
  }, [initialNodes, initialEdges, customSteps]);

  // Auto-play timer
  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStepIdx(prev => {
          if (prev >= stepsData.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, stepsData.length]);

  const currentStep = stepsData[currentStepIdx] || stepsData[0];

  const handleApply = () => {
    if (currentStep) {
      const routed = routeOrthogonalAStar(currentStep.nodesSnapshot, currentStep.edgesSnapshot, {
        gridSize: 10,
        obstacleClearance: 15,
        bendPenalty: 35,
        crossingPenalty: 25,
        channelSpacing: 12,
        portExitOffset: 20,
        smoothCorners: true,
        jumpBridges: false,
        weights: DEFAULT_OPTIMIZATION_WEIGHTS,
      });
      onApplyLayout(currentStep.nodesSnapshot, routed);
      onClose();
    }
  };

  if (!currentStep) return null;

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in text-[#e0e2e5]">
      {/* Header Bento Box */}
      <div className="bg-[#16181d] rounded-xl border border-white/5 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-widest font-semibold">
              Step-by-Step Algorithm Execution
            </span>
          </div>
          <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-white uppercase font-sans">
            4 Фазы Пайплайна Сугиямы (Sugiyama)
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Пошаговая трансформация топологии графа в строгую иерархическую схему
          </p>
        </div>

        {/* Playback Controls Bento Group */}
        <div className="flex items-center justify-center gap-1.5 bg-[#0c0d10] border border-white/10 p-1.5 rounded-xl font-mono self-start md:self-auto">
          <button
            id="btn-stepper-reset"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIdx(0);
            }}
            title="В начало"
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            id="btn-stepper-prev"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIdx(prev => Math.max(0, prev - 1));
            }}
            disabled={currentStepIdx === 0}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-300 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            id="btn-stepper-play"
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
            <span>{isPlaying ? 'ПАУЗА' : 'АВТО-ШАГ'}</span>
          </button>
          <button
            id="btn-stepper-next"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIdx(prev => Math.min(stepsData.length - 1, prev + 1));
            }}
            disabled={currentStepIdx === stepsData.length - 1}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-300 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress Bar with Steps Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stepsData.map((step, idx) => {
          const isPassed = idx <= currentStepIdx;
          const isCurrent = idx === currentStepIdx;
          return (
            <button
              key={step.stepIndex}
              id={`step-pill-${idx}`}
              onClick={() => {
                setIsPlaying(false);
                setCurrentStepIdx(idx);
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                isCurrent
                  ? 'bg-blue-600/15 border-blue-500/50 text-white shadow-lg ring-1 ring-blue-500/30'
                  : isPassed
                  ? 'bg-[#16181d] border-white/10 text-gray-300'
                  : 'bg-[#0c0d10] border-white/5 text-gray-500 hover:bg-[#16181d]'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span className="uppercase text-gray-400">ФАЗА {idx + 1}</span>
                {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-xs font-semibold truncate font-sans">{step.phase}</div>
            </button>
          );
        })}
      </div>

      {/* Current Step Explanation Bento Box */}
      <div className="bg-[#16181d] border border-white/5 rounded-xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
            {currentStep.phase}
          </div>
          <h3 className="text-lg font-bold text-white uppercase">{currentStep.title}</h3>
          <p className="text-xs text-gray-300 leading-relaxed">{currentStep.description}</p>
        </div>

        <button
          id="btn-apply-step-to-canvas"
          onClick={handleApply}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-600/20 whitespace-nowrap transition-all"
        >
          Применить этот шаг к Canvas
        </button>
      </div>

      {/* Visual Canvas Snapshot for Current Step Bento Box */}
      <div className="h-[420px] bg-[#0c0d10] border border-white/5 rounded-xl relative overflow-hidden flex items-center justify-center">
        <div
          className="absolute inset-0 opacity-40 bg-[radial-gradient(#252a35_1px,transparent_1px)] bg-[size:20px_20px]"
        />

        <svg className="w-full h-full">
          {/* Render simplified edges for this step */}
          <g>
            {currentStep.edgesSnapshot.map(e => {
              const u = currentStep.nodesSnapshot.find(n => n.id === e.sourceBlockId);
              const v = currentStep.nodesSnapshot.find(n => n.id === e.targetBlockId);
              if (!u || !v) return null;

              const x1 = u.x + u.width;
              const y1 = u.y + u.height / 2;
              const x2 = v.x;
              const y2 = v.y + v.height / 2;

              return (
                <line
                  key={e.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeOpacity="0.75"
                />
              );
            })}
          </g>

          {/* Render nodes for this step */}
          <g>
            {currentStep.nodesSnapshot.map(n => (
              <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                <rect
                  x="0"
                  y="0"
                  width={n.width}
                  height={n.height}
                  rx="8"
                  fill="#16181d"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                />
                <text
                  x={n.width / 2}
                  y={n.height / 2 + 4}
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {n.title}
                </text>
                {n.layer !== undefined && (
                  <text
                    x={8}
                    y={14}
                    fill="#60a5fa"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    L{n.layer}
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
};
