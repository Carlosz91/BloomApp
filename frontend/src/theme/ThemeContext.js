import React, { createContext, useContext, useState, useEffect } from 'react';

// Import paletas completas
const lightPalette = {
  name: 'ciruela',
  primary: '#6B3752',
  secondary: '#8F9B96',
  background: '#F5E9DC',
  card: '#FFFFFF',
  inputBg: '#F9FAFB',
  border: '#D1D5DB',
  btnPrimary: '#6B3752',
  btnPrimaryHover: '#5A2E42',
  success: '#4CAF50',
  error: '#EF4444',
  onboardingBackground: '#F5E9DC',
  // Semantic keys
  textPrimary: '#2B1A24',
  textMuted: '#7A6E75',
  primaryTint: '#6B37521A',
  onPrimary: '#FFFFFF',
  shadow: '#000000',
};

const ivoryPalette = {
  name: 'marfil',
  primary: '#8B7355',
  secondary: '#A0522D',
  background: '#F4E8DC',
  card: '#FFFFFF',
  inputBg: '#FAF9F6',
  border: '#C9ADA1',
  btnPrimary: '#8B7355',
  btnPrimaryHover: '#705A43',
  success: '#8FB973',
  error: '#ED8936',
  onboardingBackground: '#F4E8DC',
  // Semantic keys
  textPrimary: '#2E261E',
  textMuted: '#7A6F63',
  primaryTint: '#8B73551F',
  onPrimary: '#FFFFFF',
  shadow: '#000000',
};

const sagePalette = {
  name: 'salvia',
  primary: '#5A9FAF',
  secondary: '#7B9FAF',
  background: '#E8F0F1',
  card: '#FFFFFF',
  inputBg: '#F0F8F7',
  border: '#A3C4BC',
  btnPrimary: '#5A9FAF',
  btnPrimaryHover: '#407D87',
  success: '#4CAF50',
  error: '#EF4444',
  onboardingBackground: '#E8F0F1',
  // Semantic keys
  textPrimary: '#1D2F33',
  textMuted: '#66797D',
  primaryTint: '#5A9FAF1F',
  onPrimary: '#FFFFFF',
  shadow: '#000000',
};

// Context creation
const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Try to read saved palette from Engram, default to ciruela
  const [paletteName, setPaletteName] = useState('ciruela');
  const [colors, setColors] = useState(lightPalette);

  // Load palette from Engram on mount
  // useEffect commented out to prevent silent failures in web mode
  // const saved = localStorage.getItem('bloomapp_palette');
  // if (saved) {
  //   const parsed = JSON.parse(saved);
  //   setPaletteName(parsed.name || 'ciruela');
  //   setColors(parsed.colors || lightPalette);
  // }

  // Save palette choice to Engram/localStorage on change
  const savePalette = (palette) => {
    setPaletteName(palette.name);
    setColors(palette);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bloomapp_palette', JSON.stringify(palette));
      }
    } catch (e) {
      // storage no disponible (nativo): ignorar
    }
    // En producción: mem_save con topic_key design-palette/bloomapp
  };

  return (
    <ThemeContext.Provider value={{ palette: colors, setPalette: savePalette }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Helper function to get all palette colors by name
export const getPaletteColors = (paletteName) => {
  switch (paletteName) {
    case 'ciruela':
      return lightPalette;
    case 'marfil':
      return ivoryPalette;
    case 'salvia':
      return sagePalette;
    default:
      return lightPalette;
  }
};

// Export individual palette objects for direct use
export { lightPalette, ivoryPalette, sagePalette };