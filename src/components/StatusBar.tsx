import React from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  Cpu,
  Activity,
  GitCommit,
  Layers,
  Palette,
  Sun,
  Moon,
  Zap,
  CheckCircle2,
  Sparkles,
  Maximize2,
  HelpCircle,
} from 'lucide-react';
import { BenchmarkMetrics, HierarchyBreadcrumb } from '../types';

interface StatusBarProps {
  nodesCount: number;
  edgesCount: number;
  metrics?: BenchmarkMetrics;
  hierarchyPath?: HierarchyBreadcrumb[];
  activeLayoutName?: string;
  activeRoutingName?: string;
  isCalculating?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  nodesCount,
  edgesCount,
  metrics,
  hierarchyPath = [],
  activeLayoutName = 'Sugiyama',
  activeRoutingName = 'Orthogonal A*',
  isCalculating = false,
}) => {
  const { resolvedTheme, toggleTheme, setIsAppearanceModalOpen, accent } = useTheme();

  const currentLevel = hierarchyPath[hierarchyPath.length - 1];
  const isSubcircuit = hierarchyPath.length > 1;

  return (
    <footer
      id="app-system-status-bar"
      className="h-8 bg-[var(--surface-primary)] border-t border-[var(--border-subtle)] px-3 sm:px-4 text-[11px] text-[var(--text-secondary)] font-mono flex items-center justify-between z-30 select-none overflow-x-auto no-scrollbar"
    >
      {/* Left: Engine status & Contextual Mode */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Engine Status Dot */}
        <div className="flex items-center gap-1.5 text-[var(--status-success)] bg-[var(--status-success-subtle)] border border-[var(--status-success-border)] px-1.5 py-0.5 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] animate-pulse" />
          <span className="font-bold text-[10px] hidden xs:inline uppercase">EDA Engine Online</span>
          <span className="font-bold text-[10px] inline xs:hidden uppercase">Online</span>
        </div>

        {/* Mode context */}
        <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
          <Layers className="w-3 h-3 text-[var(--accent)]" />
          <span className="text-[var(--text-primary)] font-semibold truncate max-w-[120px] sm:max-w-[180px]">
            {isSubcircuit ? `Подсхема: ${currentLevel?.name}` : 'Схема: Корень'}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-[var(--text-tertiary)]">
          <span>|</span>
          <span className="text-[var(--text-secondary)]">{activeLayoutName}</span>
          <span>+</span>
          <span className="text-[var(--text-secondary)]">{activeRoutingName}</span>
        </div>
      </div>

      {/* Middle: Circuit Telemetry (Nodes, Nets, Crossings, Duration) */}
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 px-2">
        <div className="flex items-center gap-1">
          <span className="text-[var(--text-tertiary)]">Блоки:</span>
          <span className="text-[var(--text-primary)] font-bold">{nodesCount}</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[var(--text-tertiary)]">Трассы:</span>
          <span className="text-[var(--text-primary)] font-bold">{edgesCount}</span>
        </div>

        {metrics && (
          <>
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-[var(--text-tertiary)]">Пересечения:</span>
              <span className={`font-bold ${metrics.crossingsCount === 0 ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}`}>
                {metrics.crossingsCount}
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-1">
              <span className="text-[var(--text-tertiary)]">Длина:</span>
              <span className="text-[var(--text-primary)] font-bold">
                {Math.round(metrics.totalWirelength ?? 0)}px
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[var(--surface-secondary)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[10px]">
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              <span className="text-[var(--text-primary)] font-bold">
                {(metrics.executionTimeMs ?? 0).toFixed(1)}ms
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right: Appearance Quick Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        {/* Quick Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Переключить на ${resolvedTheme === 'dark' ? 'светлую' : 'тёмную'} тему`}
          className="p-1 rounded hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors active:scale-95"
        >
          {resolvedTheme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-500" />}
        </button>

        {/* Open Appearance Modal */}
        <button
          onClick={() => setIsAppearanceModalOpen(true)}
          title="Открыть палитру и настройки внешнего вида"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors active:scale-95 border border-transparent hover:border-[var(--border-default)]"
        >
          <Palette className="w-3 h-3 text-[var(--accent)]" />
          <span className="hidden sm:inline text-[10px]">Тема</span>
        </button>
      </div>
    </footer>
  );
};
