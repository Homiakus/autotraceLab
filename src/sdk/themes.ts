/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DiagramTheme {
  name: string;
  background: string;
  gridColor: string;
  gridPattern: 'dots' | 'lines' | 'none';
  nodeFill: string;
  nodeStroke: string;
  nodeStrokeWidth: number;
  nodeRadius: number;
  nodeText: string;
  nodeSubtext: string;
  edgeColor: string;
  edgeWidth: number;
  portFill: string;
  portStroke: string;
  portRadius: number;
  labelBg: string;
  labelText: string;
  fontFamily: string;
}

export const THEME_DARK: DiagramTheme = {
  name: 'dark',
  background: '#0d1117',
  gridColor: '#21262d',
  gridPattern: 'dots',
  nodeFill: '#161b22',
  nodeStroke: '#30363d',
  nodeStrokeWidth: 1.5,
  nodeRadius: 8,
  nodeText: '#f0f6fc',
  nodeSubtext: '#8b949e',
  edgeColor: '#58a6ff',
  edgeWidth: 2,
  portFill: '#1f6feb',
  portStroke: '#58a6ff',
  portRadius: 4,
  labelBg: '#161b22',
  labelText: '#79c0ff',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export const THEME_LIGHT: DiagramTheme = {
  name: 'light',
  background: '#f8fafc',
  gridColor: '#e2e8f0',
  gridPattern: 'dots',
  nodeFill: '#ffffff',
  nodeStroke: '#cbd5e1',
  nodeStrokeWidth: 1.5,
  nodeRadius: 8,
  nodeText: '#0f172a',
  nodeSubtext: '#64748b',
  edgeColor: '#2563eb',
  edgeWidth: 2,
  portFill: '#3b82f6',
  portStroke: '#1d4ed8',
  portRadius: 4,
  labelBg: '#ffffff',
  labelText: '#1e40af',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export const THEME_BLUEPRINT: DiagramTheme = {
  name: 'blueprint',
  background: '#0b2545',
  gridColor: '#133a69',
  gridPattern: 'lines',
  nodeFill: '#0e315d',
  nodeStroke: '#38bdf8',
  nodeStrokeWidth: 1.5,
  nodeRadius: 4,
  nodeText: '#e0f2fe',
  nodeSubtext: '#7dd3fc',
  edgeColor: '#38bdf8',
  edgeWidth: 2,
  portFill: '#0284c7',
  portStroke: '#7dd3fc',
  portRadius: 3.5,
  labelBg: '#0e315d',
  labelText: '#bae6fd',
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
};

export const THEME_MINIMAL: DiagramTheme = {
  name: 'minimal',
  background: '#ffffff',
  gridColor: '#f1f5f9',
  gridPattern: 'none',
  nodeFill: '#ffffff',
  nodeStroke: '#000000',
  nodeStrokeWidth: 1,
  nodeRadius: 0,
  nodeText: '#000000',
  nodeSubtext: '#555555',
  edgeColor: '#000000',
  edgeWidth: 1.5,
  portFill: '#ffffff',
  portStroke: '#000000',
  portRadius: 3,
  labelBg: '#ffffff',
  labelText: '#000000',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

export const THEME_CYBERPUNK: DiagramTheme = {
  name: 'cyberpunk',
  background: '#120726',
  gridColor: '#2d1454',
  gridPattern: 'lines',
  nodeFill: '#1f0d3d',
  nodeStroke: '#f43f5e',
  nodeStrokeWidth: 2,
  nodeRadius: 10,
  nodeText: '#fde047',
  nodeSubtext: '#a855f7',
  edgeColor: '#06b6d4',
  edgeWidth: 2.5,
  portFill: '#f43f5e',
  portStroke: '#fb7185',
  portRadius: 5,
  labelBg: '#1f0d3d',
  labelText: '#22d3ee',
  fontFamily: 'ui-monospace, monospace',
};

export const THEMES: Record<string, DiagramTheme> = {
  dark: THEME_DARK,
  light: THEME_LIGHT,
  blueprint: THEME_BLUEPRINT,
  minimal: THEME_MINIMAL,
  cyberpunk: THEME_CYBERPUNK,
};

/**
 * Resolves a theme from a name, partial overrides, or full theme object.
 */
export function resolveTheme(themeInput?: string | Partial<DiagramTheme>): DiagramTheme {
  if (!themeInput) return THEME_LIGHT;
  if (typeof themeInput === 'string') {
    return THEMES[themeInput.toLowerCase()] || THEME_LIGHT;
  }
  const base = THEMES[themeInput.name || 'light'] || THEME_LIGHT;
  return {
    ...base,
    ...themeInput,
  };
}
