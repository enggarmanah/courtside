export const THEME_COLOR_STEEL = 'steel' as const;
export type ThemeColor = typeof THEME_COLOR_STEEL;
export const DEFAULT_THEME_COLOR: ThemeColor = THEME_COLOR_STEEL;

export interface ColorPalette {
  50: string; 100: string; 150: string; 200: string;
  300: string; 400: string; 500: string; 600: string;
  700: string; 800: string; 900: string; 950: string;
}

export const THEME_PALETTES: Record<ThemeColor, ColorPalette> = {
  steel: {
    50: '#EEF2FC', 100: '#E0E7F8', 150: '#D2DCF5', 200: '#C4D1F1',
    300: '#9CB3EA', 400: '#7292E4', 500: '#5375E2', 600: '#3F5BC0',
    700: '#334998', 800: '#293976', 900: '#222D5A', 950: '#161d3a',
  },
};

export const getThemePalette = (color: ThemeColor): ColorPalette => {
  return THEME_PALETTES[color] || THEME_PALETTES[DEFAULT_THEME_COLOR];
};