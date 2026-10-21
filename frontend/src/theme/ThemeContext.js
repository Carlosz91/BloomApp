import React, { createContext, useContext, useState, useEffect } from 'react';

// Import paletas completas.
// Valores tomados del mock de referencia (Appointment scheduling system):
// ciruela = paleta "plum/cream" del diseño; marfil y salvia son derivados
// (arena cálido rosado y familia salvia) con el mismo contrato de llaves.
const lightPalette = {
  name: 'ciruela',
  primary: '#733e5d',
  secondary: '#a87476',
  background: '#f7f1e9',
  card: '#fffdfb',
  inputBg: '#eee8e3',
  border: '#e9e1dc',
  btnPrimary: '#733e5d',
  btnPrimaryHover: '#5f3350',
  success: '#6d8478',
  error: '#b16f67',
  onboardingBackground: '#f7f1e9',
  // Semantic keys
  textPrimary: '#332a30',
  textMuted: '#81777d',
  primaryTint: '#f2e9ee',
  onPrimary: '#fffdfb',
  shadow: '#462d3a',
  // Nuevas llaves del diseño de referencia
  heading: '#3d2734',
  sage: '#6d8478',
  rose: '#a87476',
  eyebrow: '#a16f62',
  plumSoft: '#f2e9ee',
  line: '#e9e1dc',
  cream: '#f7f1e9',
  sageBg: '#e8eee9',
  sandBg: '#ede3d9',
  badge: '#e0bacb',
};

const ivoryPalette = {
  name: 'marfil',
  primary: '#936a57',
  secondary: '#b9896d',
  background: '#f3ede2',
  card: '#fffdfb',
  inputBg: '#ece3d5',
  border: '#e5d8ca',
  btnPrimary: '#936a57',
  btnPrimaryHover: '#7d5747',
  success: '#6d8478',
  error: '#b16f67',
  onboardingBackground: '#f3ede2',
  // Semantic keys
  textPrimary: '#38302b',
  textMuted: '#8a7d74',
  primaryTint: '#ede3d9',
  onPrimary: '#fffdfb',
  shadow: '#5d4a3a',
  // Nuevas llaves del diseño de referencia (derivado marfil)
  heading: '#43352c',
  sage: '#6d8478',
  rose: '#a87476',
  eyebrow: '#936a57',
  plumSoft: '#ede3d9',
  line: '#e5d8ca',
  cream: '#f3ede2',
  sageBg: '#e8eee9',
  sandBg: '#ede3d9',
  badge: '#e6c9b8',
};

const sagePalette = {
  name: 'salvia',
  primary: '#6d8478',
  secondary: '#8fa89a',
  background: '#f0f3f0',
  card: '#fffdfb',
  inputBg: '#edf2ee',
  border: '#dde5dc',
  btnPrimary: '#6d8478',
  btnPrimaryHover: '#556b60',
  success: '#6d8478',
  error: '#b16f67',
  onboardingBackground: '#f0f3f0',
  // Semantic keys
  textPrimary: '#2f3833',
  textMuted: '#7d8781',
  primaryTint: '#e8eee9',
  onPrimary: '#fffdfb',
  shadow: '#3f4f45',
  // Nuevas llaves del diseño de referencia (derivado salvia)
  heading: '#40584c',
  sage: '#6d8478',
  rose: '#a87476',
  eyebrow: '#6d8478',
  plumSoft: '#e8eee9',
  line: '#dde5dc',
  cream: '#f0f3f0',
  sageBg: '#e8eee9',
  sandBg: '#ede3d9',
  badge: '#cfe0d5',
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
