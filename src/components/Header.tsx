import React, { useState } from 'react';
import { Network, BarChart3, BookOpen, Layers, Code2, Cpu, Download } from 'lucide-react';
import { generateAndDownloadProjectZip } from '../utils/zipExporter';

export type ActiveTab = 'canvas' | 'benchmark' | 'research' | 'stepper' | 'code';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenQuickTour?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadZip = async () => {
    try {
      setIsDownloading(true);
      await generateAndDownloadProjectZip();
    } catch (err) {
      console.error('Failed to download ZIP:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const tabs = [
    { id: 'canvas' as ActiveTab, label: 'Лаборатория', fullLabel: 'Интерактивная Лаборатория', icon: Network },
    { id: 'benchmark' as ActiveTab, label: 'Бенчмарк', fullLabel: 'Бенчмарк Матрица', icon: BarChart3 },
    { id: 'research' as ActiveTab, label: 'Исследование', fullLabel: 'Научное Исследование', icon: BookOpen },
    { id: 'stepper' as ActiveTab, label: '4 Фазы', fullLabel: '4 Фазы Сугиямы', icon: Layers },
    { id: 'code' as ActiveTab, label: 'Код & ZIP', fullLabel: 'Код & Скачать ZIP', icon: Code2 },
  ];

  return (
    <header className="bg-[#0c0d10] border-b border-white/10 text-[#e0e2e5] sticky top-0 z-30 px-3 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Left Title & Monospace Subtitle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white uppercase font-sans">
                  AutoTrace Lab
                </h1>
                <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono text-blue-400 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                  <span>v2.4 EDA</span>
                </div>
              </div>
              <p className="text-[10px] sm:text-[11px] text-blue-400/90 font-mono uppercase tracking-wider line-clamp-1">
                Schematic Layout & Multi-Criteria Routing
              </p>
            </div>
          </div>

          {/* Quick Download Zip Button on Mobile */}
          <div className="flex md:hidden items-center gap-1">
            <button
              id="mobile-header-download-zip"
              onClick={handleDownloadZip}
              disabled={isDownloading}
              title="Скачать полный архив программы (.ZIP)"
              className="flex items-center gap-1 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 px-2 py-1 rounded-lg font-mono text-[10px] font-bold active:scale-95 transition-transform"
            >
              <Download className="w-3 h-3" />
              <span>.ZIP</span>
            </button>
          </div>
        </div>

        {/* Right Navigation & Status Bento Tags with touch scroll */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 md:pb-0">
          <nav className="flex items-center gap-1 bg-[#16181d] p-1 rounded-xl border border-white/5 min-w-max">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap active:scale-95 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  <span className="hidden sm:inline">{tab.fullLabel}</span>
                  <span className="inline sm:hidden">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            id="desktop-header-download-zip"
            onClick={handleDownloadZip}
            disabled={isDownloading}
            title="Скачать полный архив программы (.ZIP)"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-semibold transition-all active:scale-95 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Архивация...' : 'Скачать .ZIP'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
