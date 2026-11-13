export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedThemeMode = 'light' | 'dark';
export type ColorThemeId = 'indigo' | 'ocean' | 'emerald' | 'rose' | 'amber' | 'violet';

export interface ColorThemePalette {
  accent: string;
  accentHover: string;
  bgBase: string;
  bgSurface: string;
  ghChart: string;
  themeColor: string;
}

export interface ColorThemeDefinition {
  id: ColorThemeId;
  previewGradient: string;
  light: ColorThemePalette;
  dark: ColorThemePalette;
}

export const DEFAULT_THEME_MODE: ThemeMode = 'auto';
export const DEFAULT_COLOR_THEME: ColorThemeId = 'indigo';

export const COLOR_THEMES: readonly ColorThemeDefinition[] = [
  {
    id: 'indigo',
    previewGradient: 'linear-gradient(135deg, #4f46e5 0%, #0ea5e9 50%, #a855f7 100%)',
    light: {
      accent: '#4f46e5',
      accentHover: '#4338ca',
      bgBase: '#f8fafc',
      bgSurface: '#ffffff',
      ghChart: '4f46e5',
      themeColor: '#f8fafc',
    },
    dark: {
      accent: '#818cf8',
      accentHover: '#a5b4fc',
      bgBase: '#090d16',
      bgSurface: '#0f1623',
      ghChart: '818cf8',
      themeColor: '#090d16',
    },
  },
  {
    id: 'ocean',
    previewGradient: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 50%, #3b82f6 100%)',
    light: {
      accent: '#0284c7',
      accentHover: '#0369a1',
      bgBase: '#f5f9fc',
      bgSurface: '#ffffff',
      ghChart: '0284c7',
      themeColor: '#f5f9fc',
    },
    dark: {
      accent: '#38bdf8',
      accentHover: '#7dd3fc',
      bgBase: '#071018',
      bgSurface: '#0c1926',
      ghChart: '38bdf8',
      themeColor: '#071018',
    },
  },
  {
    id: 'emerald',
    previewGradient: 'linear-gradient(135deg, #059669 0%, #14b8a6 50%, #0ea5e9 100%)',
    light: {
      accent: '#059669',
      accentHover: '#047857',
      bgBase: '#f5fbf8',
      bgSurface: '#ffffff',
      ghChart: '059669',
      themeColor: '#f5fbf8',
    },
    dark: {
      accent: '#34d399',
      accentHover: '#6ee7b7',
      bgBase: '#07120e',
      bgSurface: '#0c1d17',
      ghChart: '34d399',
      themeColor: '#07120e',
    },
  },
  {
    id: 'rose',
    previewGradient: 'linear-gradient(135deg, #e11d48 0%, #ec4899 50%, #f97316 100%)',
    light: {
      accent: '#e11d48',
      accentHover: '#be123c',
      bgBase: '#fdf7f8',
      bgSurface: '#ffffff',
      ghChart: 'e11d48',
      themeColor: '#fdf7f8',
    },
    dark: {
      accent: '#fb7185',
      accentHover: '#fda4af',
      bgBase: '#13080c',
      bgSurface: '#1e0e15',
      ghChart: 'fb7185',
      themeColor: '#13080c',
    },
  },
  {
    id: 'amber',
    previewGradient: 'linear-gradient(135deg, #d97706 0%, #f97316 50%, #e11d48 100%)',
    light: {
      accent: '#d97706',
      accentHover: '#b45309',
      bgBase: '#fcfaf5',
      bgSurface: '#ffffff',
      ghChart: 'd97706',
      themeColor: '#fcfaf5',
    },
    dark: {
      accent: '#fbbf24',
      accentHover: '#fcd34d',
      bgBase: '#120e07',
      bgSurface: '#1d170c',
      ghChart: 'fbbf24',
      themeColor: '#120e07',
    },
  },
  {
    id: 'violet',
    previewGradient: 'linear-gradient(135deg, #7c3aed 0%, #d946ef 50%, #6366f1 100%)',
    light: {
      accent: '#7c3aed',
      accentHover: '#6d28d9',
      bgBase: '#f9f7fd',
      bgSurface: '#ffffff',
      ghChart: '7c3aed',
      themeColor: '#f9f7fd',
    },
    dark: {
      accent: '#c084fc',
      accentHover: '#d8b4fe',
      bgBase: '#0d0916',
      bgSurface: '#160f26',
      ghChart: 'c084fc',
      themeColor: '#0d0916',
    },
  },
] as const;

export const COLOR_THEME_IDS: readonly ColorThemeId[] = COLOR_THEMES.map((t) => t.id);

export const COLOR_THEME_MAP: Record<ColorThemeId, ColorThemeDefinition> = COLOR_THEMES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<ColorThemeId, ColorThemeDefinition>
);

export function isValidColorTheme(value: string | null | undefined): value is ColorThemeId {
  return Boolean(value && value in COLOR_THEME_MAP);
}

export function isValidThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark';
}
