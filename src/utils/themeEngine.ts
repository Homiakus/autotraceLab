/**
 * AutoTrace Lab — Advanced Design System Theme Engine
 * Supports OKLCH/HSL dynamic color calculations, contrast normalization,
 * dark/light themes, accent palettes, motion modes, and density configurations.
 */

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type InterfaceDensity = 'comfortable' | 'compact';
export type MotionPreference = 'system' | 'full' | 'reduced';

export interface AccentPreset {
  id: string;
  name: string;
  nameRu: string;
  hex: string;
  category: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'electric-blue', name: 'Electric Blue', nameRu: 'Электрик Синий', hex: '#3b82f6', category: 'Classic EDA' },
  { id: 'cyan-glow', name: 'Cyan Photon', nameRu: 'Циан Фотон', hex: '#06b6d4', category: 'High Tech' },
  { id: 'emerald-matrix', name: 'Emerald PCB', nameRu: 'Изумруд PCB', hex: '#10b981', category: 'Silicon' },
  { id: 'violet-quantum', name: 'Quantum Violet', nameRu: 'Квантовый Фиолетовый', hex: '#8b5cf6', category: 'Deep Science' },
  { id: 'amber-gold', name: 'Silicon Amber', nameRu: 'Кремниевый Янтарь', hex: '#f59e0b', category: 'Warm Wave' },
  { id: 'rose-plasma', name: 'Rose Plasma', nameRu: 'Плазменная Роза', hex: '#f43f5e', category: 'Vibrant' },
  { id: 'coral-sunset', name: 'Optic Orange', nameRu: 'Оптический Оранж', hex: '#f97316', category: 'Energetic' },
  { id: 'lime-laser', name: 'Laser Lime', nameRu: 'Лазерный Лайм', hex: '#84cc16', category: 'Optics' },
  { id: 'monochrome', name: 'Monochrome Slate', nameRu: 'Монохром Слейт', hex: '#64748b', category: 'Minimalist' },
];

export interface ColorTokens {
  accent: string;
  accentHover: string;
  accentActive: string;
  accentSubtle: string;
  accentMuted: string;
  accentBorder: string;
  accentContrast: string;
  accentFocusRing: string;
}

// Convert Hex to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    };
  }
  return null;
}

// Convert RGB to HSL
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Convert HSL to Hex
export function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Calculate relative luminance for WCAG contrast
export function getLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// Check WCAG Contrast Ratio
export function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;
  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Generate normalized accent palette derived from base hex
export function generateAccentPalette(baseHex: string, resolvedTheme: ResolvedTheme): ColorTokens {
  const rgb = hexToRgb(baseHex) || { r: 59, g: 130, b: 246 };
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Normalize saturation and lightness for consistent perceptual weight
  const clampedSat = Math.min(95, Math.max(45, hsl.s));
  const targetLightness = resolvedTheme === 'dark' ? Math.max(50, Math.min(62, hsl.l)) : Math.max(42, Math.min(54, hsl.l));

  const primaryAccent = hslToHex(hsl.h, clampedSat, targetLightness);
  const hoverAccent = hslToHex(hsl.h, clampedSat, resolvedTheme === 'dark' ? targetLightness + 8 : targetLightness - 8);
  const activeAccent = hslToHex(hsl.h, clampedSat, resolvedTheme === 'dark' ? targetLightness - 6 : targetLightness - 14);

  // Contrast foreground: white or dark charcoal
  const lum = getLuminance(rgb.r, rgb.g, rgb.b);
  const contrastText = lum > 0.42 ? '#090a0f' : '#ffffff';

  const subtleLightness = resolvedTheme === 'dark' ? 14 : 94;
  const subtleSat = Math.min(50, clampedSat);
  const subtleAccent = hslToHex(hsl.h, subtleSat, subtleLightness);

  const mutedLightness = resolvedTheme === 'dark' ? 22 : 88;
  const mutedAccent = hslToHex(hsl.h, Math.min(40, clampedSat), mutedLightness);

  const borderLightness = resolvedTheme === 'dark' ? 32 : 75;
  const borderAccent = hslToHex(hsl.h, Math.min(60, clampedSat), borderLightness);

  const focusRing = hslToHex(hsl.h, Math.min(90, clampedSat + 10), resolvedTheme === 'dark' ? 60 : 45);

  return {
    accent: primaryAccent,
    accentHover: hoverAccent,
    accentActive: activeAccent,
    accentSubtle: subtleAccent,
    accentMuted: mutedAccent,
    accentBorder: borderAccent,
    accentContrast: contrastText,
    accentFocusRing: focusRing,
  };
}

// Apply theme tokens to DOM root element
export function applyThemeToDocument(
  theme: ThemeMode,
  resolvedTheme: ResolvedTheme,
  accentId: string,
  customHex: string,
  density: InterfaceDensity,
  motion: MotionPreference
) {
  const root = document.documentElement;

  // Set Theme attribute
  root.setAttribute('data-theme', resolvedTheme);
  root.setAttribute('data-theme-preference', theme);
  root.setAttribute('data-density', density);
  root.setAttribute('data-motion', motion);

  // Determine base accent hex
  let baseHex = '#3b82f6';
  const preset = ACCENT_PRESETS.find(p => p.id === accentId);
  if (preset) {
    baseHex = preset.hex;
    root.setAttribute('data-accent', preset.id);
  } else if (accentId === 'custom' && customHex) {
    baseHex = customHex;
    root.setAttribute('data-accent', 'custom');
  }

  // Generate tokens
  const tokens = generateAccentPalette(baseHex, resolvedTheme);

  // Apply CSS Variables directly
  root.style.setProperty('--accent', tokens.accent);
  root.style.setProperty('--accent-hover', tokens.accentHover);
  root.style.setProperty('--accent-active', tokens.accentActive);
  root.style.setProperty('--accent-subtle', tokens.accentSubtle);
  root.style.setProperty('--accent-muted', tokens.accentMuted);
  root.style.setProperty('--accent-border', tokens.accentBorder);
  root.style.setProperty('--accent-contrast', tokens.accentContrast);
  root.style.setProperty('--accent-focus-ring', tokens.accentFocusRing);
}
