import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  setThemeMode: () => {},
  isDarkMode: false,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('smart_attendance_theme_mode') as ThemeMode;
      if (saved && ['light', 'dark', 'system'].includes(saved)) {
        return saved;
      }
      // Migration from old key if present
      const oldVal = localStorage.getItem('smart_attendance_theme');
      if (oldVal === 'dark') return 'dark';
      if (oldVal === 'light') return 'light';
    } catch (e) {
      console.error('Failed to read theme preference:', e);
    }
    return 'system';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Listen to system media query changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const isDarkMode = themeMode === 'system' ? systemIsDark : themeMode === 'dark';

  useEffect(() => {
    try {
      localStorage.setItem('smart_attendance_theme_mode', themeMode);
    } catch (e) {
      console.error('Failed to save theme preference:', e);
    }

    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode, isDarkMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const toggleTheme = () => {
    setThemeModeState((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
