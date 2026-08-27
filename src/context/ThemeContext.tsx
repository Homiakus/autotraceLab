import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  ThemeMode,
  ResolvedTheme,
  InterfaceDensity,
  MotionPreference,
  ACCENT_PRESETS,
  applyThemeToDocument,
} from '../utils/themeEngine';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  accent: string;
  customAccentHex: string;
  density: InterfaceDensity;
  motionMode: MotionPreference;
  isAppearanceModalOpen: boolean;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accentId: string) => void;
  setCustomAccentHex: (hex: string) => void;
  setDensity: (density: InterfaceDensity) => void;
  setMotionMode: (mode: MotionPreference) => void;
  setIsAppearanceModalOpen: (isOpen: boolean) => void;
  toggleTheme: () => void;
  resetToDefaults: () => void;
}

const STORAGE_KEYS = {
  THEME: 'autotrace_theme_mode',
  ACCENT: 'autotrace_theme_accent',
  CUSTOM_ACCENT: 'autotrace_theme_custom_accent',
  DENSITY: 'autotrace_theme_density',
  MOTION: 'autotrace_theme_motion',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const VALID_THEMES: ThemeMode[] = [
  'system',
  'dark',
  'light',
  'blueprint',
  'pcb_emerald',
  'amber_crt',
  'synthwave',
  'nordic_frost',
  'solarized',
];

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial settings or fallback
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode;
    return VALID_THEMES.includes(saved) ? saved : 'dark';
  });

  const [accent, setAccentState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACCENT);
    return saved || 'electric-blue';
  });

  const [customAccentHex, setCustomAccentHexState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_ACCENT);
    return saved || '#3b82f6';
  });

  const [density, setDensityState] = useState<InterfaceDensity>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DENSITY) as InterfaceDensity;
    return saved === 'compact' || saved === 'comfortable' ? saved : 'comfortable';
  });

  const [motionMode, setMotionModeState] = useState<MotionPreference>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MOTION) as MotionPreference;
    return saved === 'full' || saved === 'reduced' || saved === 'system' ? saved : 'system';
  });

  const [isAppearanceModalOpen, setIsAppearanceModalOpen] = useState(false);

  // Determine system preference
  const getSystemTheme = useCallback((): ResolvedTheme => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  // Listen to OS system color scheme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

  // Apply DOM modifications whenever state changes
  useEffect(() => {
    applyThemeToDocument(theme, resolvedTheme, accent, customAccentHex, density, motionMode);
  }, [theme, resolvedTheme, accent, customAccentHex, density, motionMode]);

  // Setters with persistent storage
  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
  };

  const setAccent = (newAccent: string) => {
    setAccentState(newAccent);
    localStorage.setItem(STORAGE_KEYS.ACCENT, newAccent);
  };

  const setCustomAccentHex = (hex: string) => {
    setCustomAccentHexState(hex);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_ACCENT, hex);
  };

  const setDensity = (newDensity: InterfaceDensity) => {
    setDensityState(newDensity);
    localStorage.setItem(STORAGE_KEYS.DENSITY, newDensity);
  };

  const setMotionMode = (newMotion: MotionPreference) => {
    setMotionModeState(newMotion);
    localStorage.setItem(STORAGE_KEYS.MOTION, newMotion);
  };

  const toggleTheme = () => {
    if (resolvedTheme === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  const resetToDefaults = () => {
    setTheme('dark');
    setAccent('electric-blue');
    setCustomAccentHex('#3b82f6');
    setDensity('comfortable');
    setMotionMode('system');
  };

  return (
    <ThemeContext.Provider
      value={{
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
        toggleTheme,
        resetToDefaults,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
