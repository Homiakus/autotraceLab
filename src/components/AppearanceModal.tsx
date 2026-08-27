import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  ACCENT_PRESETS,
  ThemeMode,
  InterfaceDensity,
  MotionPreference,
  getContrastRatio,
} from '../utils/themeEngine';
import {
  Palette,
  Sun,
  Moon,
  Laptop,
  Check,
  RotateCcw,
  X,
  Sparkles,
  Zap,
  Sliders,
  Eye,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { toast } from '../utils/toastService';

export const AppearanceModal: React.FC = () => {
  const {
    theme,
    resolvedTheme,
    accent,
    customAccentHex,
    density,
    motionMode,
    isAppearanceModalOpen,
    setTheme,
    setAccent,
    setCustomAccentHex,
    setDensity,
    setMotionMode,
    setIsAppearanceModalOpen,
    resetToDefaults,
  } = useTheme();

  const [customInputHex, setCustomInputHex] = useState(customAccentHex);

  if (!isAppearanceModalOpen) return null;

  // Calculate contrast ratio against current background
  const bgHex = resolvedTheme === 'dark' ? '#0c0d10' : '#ffffff';
  const activeColorHex = accent === 'custom' ? customAccentHex : (ACCENT_PRESETS.find(p => p.id === accent)?.hex || '#3b82f6');
  const contrastWithBg = getContrastRatio(activeColorHex, bgHex);
  const isContrastGood = contrastWithBg >= 3.0;

  const handleCustomHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    setCustomInputHex(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setCustomAccentHex(val);
      setAccent('custom');
    }
  };

  const handleCustomColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInputHex(val);
    setCustomAccentHex(val);
    setAccent('custom');
  };

  const handleReset = () => {
    resetToDefaults();
    setCustomInputHex('#3b82f6');
    toast.info('Настройки темы сброшены к значениям по умолчанию');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => setIsAppearanceModalOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="appearance-modal-title"
    >
      <div
        className="w-full max-w-xl bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[var(--text-primary)] animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-primary)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)]">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 id="appearance-modal-title" className="text-base font-bold text-[var(--text-primary)]">
                Внешний вид & Тематизация
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Кастомизация цветов, тем, плотности и системы движения
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAppearanceModalOpen(false)}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* 1. Theme Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 font-mono">
              <Sun className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Режим Темы (Theme Mode)</span>
            </label>

            <div className="grid grid-cols-3 gap-2.5">
              {/* System */}
              <button
                onClick={() => {
                  setTheme('system');
                  toast.success('Тема: Автоматически (Системная)');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all active:scale-95 ${
                  theme === 'system'
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)] font-semibold shadow-md'
                    : 'border-[var(--border-default)] hover:border-[var(--border-strong)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="w-full h-12 rounded-lg bg-gradient-to-r from-slate-900 via-slate-700 to-slate-200 border border-white/10 flex items-center justify-center">
                  <Laptop className="w-5 h-5 text-white drop-shadow" />
                </div>
                <div className="text-xs flex items-center gap-1">
                  <span>Системная</span>
                  {theme === 'system' && <Check className="w-3 h-3 text-[var(--accent)]" />}
                </div>
              </button>

              {/* Dark */}
              <button
                onClick={() => {
                  setTheme('dark');
                  toast.success('Тема: Тёмная (Dark Mode)');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all active:scale-95 ${
                  theme === 'dark'
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)] font-semibold shadow-md'
                    : 'border-[var(--border-default)] hover:border-[var(--border-strong)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="w-full h-12 rounded-lg bg-[#0c0d10] border border-white/15 flex items-center justify-center">
                  <Moon className="w-5 h-5 text-blue-400 drop-shadow" />
                </div>
                <div className="text-xs flex items-center gap-1">
                  <span>Тёмная</span>
                  {theme === 'dark' && <Check className="w-3 h-3 text-[var(--accent)]" />}
                </div>
              </button>

              {/* Light */}
              <button
                onClick={() => {
                  setTheme('light');
                  toast.success('Тема: Светлая (Light Mode)');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all active:scale-95 ${
                  theme === 'light'
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)] font-semibold shadow-md'
                    : 'border-[var(--border-default)] hover:border-[var(--border-strong)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="w-full h-12 rounded-lg bg-[#f8fafc] border border-slate-300 flex items-center justify-center">
                  <Sun className="w-5 h-5 text-amber-500 drop-shadow" />
                </div>
                <div className="text-xs flex items-center gap-1">
                  <span>Светлая</span>
                  {theme === 'light' && <Check className="w-3 h-3 text-[var(--accent)]" />}
                </div>
              </button>
            </div>
          </div>

          {/* 2. Accent Color Presets & Custom Palette */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 font-mono">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Акцентный Цвет (Accent Palette)</span>
              </label>
              <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                {accent === 'custom' ? `Custom: ${customAccentHex}` : ACCENT_PRESETS.find(p => p.id === accent)?.nameRu}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
              {ACCENT_PRESETS.map(preset => {
                const isSelected = accent === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setAccent(preset.id);
                      toast.success(`Акцент: ${preset.nameRu}`);
                    }}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all text-left active:scale-95 ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] shadow-sm'
                        : 'border-[var(--border-default)] hover:border-[var(--border-strong)] bg-[var(--surface-secondary)]'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center shadow-inner"
                      style={{ backgroundColor: preset.hex }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white drop-shadow" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {preset.nameRu}
                      </div>
                      <div className="text-[10px] text-[var(--text-tertiary)] font-mono truncate">
                        {preset.hex}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Color Input */}
            <div className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <input
                  type="color"
                  value={customAccentHex}
                  onChange={handleCustomColorPickerChange}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                  title="Выбрать свой цвет"
                />
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Пользовательский цвет (Custom HEX)
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)]">
                    Авто-нормализация контраста и генерация палитры
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customInputHex}
                  onChange={handleCustomHexChange}
                  placeholder="#3b82f6"
                  maxLength={7}
                  className="w-24 px-2.5 py-1 text-xs font-mono rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-primary)] uppercase focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={() => {
                    setAccent('custom');
                    setCustomAccentHex(customInputHex);
                    toast.success(`Пользовательский акцент установлен: ${customInputHex}`);
                  }}
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-90 transition-opacity"
                >
                  Применить
                </button>
              </div>
            </div>

            {/* Contrast Indicator Badge */}
            <div className="flex items-center gap-2 text-xs">
              {isContrastGood ? (
                <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-[11px] font-mono">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>WCAG Contrast Ratio: {contrastWithBg.toFixed(2)}:1 (Отличный)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg text-[11px] font-mono">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>WCAG Contrast: {contrastWithBg.toFixed(2)}:1 (Рекомендуется скорректировать)</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Interface Density */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 font-mono">
              <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Плотность интерфейса (Interface Density)</span>
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setDensity('comfortable');
                  toast.info('Плотность: Просторная (Comfortable)');
                }}
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  density === 'comfortable'
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)] font-semibold'
                    : 'border-[var(--border-default)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="text-left">
                  <div className="text-xs font-bold">Просторная (Comfortable)</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">Стандартные отступы и размеры</div>
                </div>
                {density === 'comfortable' && <Check className="w-4 h-4 text-[var(--accent)]" />}
              </button>

              <button
                onClick={() => {
                  setDensity('compact');
                  toast.info('Плотность: Компактная (Compact EDA)');
                }}
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  density === 'compact'
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)] font-semibold'
                    : 'border-[var(--border-default)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="text-left">
                  <div className="text-xs font-bold">Компактная (Compact EDA)</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">Плотная инженерная сетка</div>
                </div>
                {density === 'compact' && <Check className="w-4 h-4 text-[var(--accent)]" />}
              </button>
            </div>
          </div>

          {/* 4. Motion System Preference */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 font-mono">
              <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Система движения и анимаций (Motion Preference)</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setMotionMode('system');
                  toast.info('Motion: Системный (OS Prefers)');
                }}
                className={`p-2 rounded-xl border text-center text-xs transition-all ${
                  motionMode === 'system'
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)] font-semibold'
                    : 'border-[var(--border-default)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="font-bold">Системный</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">По настройкам ОС</div>
              </button>

              <button
                onClick={() => {
                  setMotionMode('full');
                  toast.info('Motion: Полные анимации (60 FPS)');
                }}
                className={`p-2 rounded-xl border text-center text-xs transition-all ${
                  motionMode === 'full'
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)] font-semibold'
                    : 'border-[var(--border-default)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="font-bold">Плавный (Full)</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">Микроинтеракции 60fps</div>
              </button>

              <button
                onClick={() => {
                  setMotionMode('reduced');
                  toast.info('Motion: Уменьшенное движение (Reduced Motion)');
                }}
                className={`p-2 rounded-xl border text-center text-xs transition-all ${
                  motionMode === 'reduced'
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)] font-semibold'
                    : 'border-[var(--border-default)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="font-bold">Уменьшенный</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">Мгновенные переходы</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-primary)] flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors font-mono"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить настройки</span>
          </button>

          <button
            onClick={() => setIsAppearanceModalOpen(false)}
            className="px-4 py-1.5 text-xs font-bold rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-90 transition-opacity active:scale-95 shadow-md"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
