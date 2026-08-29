import React, { useRef } from 'react';
import {
  Cpu,
  FolderOpen,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  onLoadDiagram?: (file: File) => void;
}

export const Header: React.FC<HeaderProps> = ({ onLoadDiagram }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme, toggleTheme } = useTheme();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onLoadDiagram) {
      onLoadDiagram(file);
    }
    // Reset the input so selecting the same file again re-triggers onChange.
    e.target.value = '';
  };

  return (
    <header className="bg-[var(--surface-primary)] border-b border-[var(--border-subtle)] text-[var(--text-primary)] sticky top-0 z-30 px-3 sm:px-6 py-2.5 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left Title & Monospace Subtitle */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)] flex-shrink-0 transition-colors">
            <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-[var(--text-primary)] uppercase font-sans">
              AutoTrace Lab
            </h1>
            <p className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-mono uppercase tracking-wider truncate">
              Schematic Layout & Routing
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            onClick={toggleTheme}
            title={`Переключить на ${resolvedTheme === 'dark' ? 'светлую' : 'тёмную'} тему`}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors active:scale-95"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-blue-500" />
            )}
          </button>

          <button
            id="btn-load-diagram"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--accent-contrast)] text-xs font-semibold shadow-md transition-all active:scale-95 whitespace-nowrap"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Загрузить диаграмму</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
    </header>
  );
};
