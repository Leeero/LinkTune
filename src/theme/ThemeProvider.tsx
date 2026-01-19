import { ConfigProvider } from 'antd';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { getLinkTuneTheme, type ThemeMode } from './linkTuneTheme';

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

const STORAGE_KEY = 'linktune:theme-mode';

function readInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;

  // 默认深色更贴合音乐场景，也更护眼
  return 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readInitialMode);

  const setMode = (m: ThemeMode) => setModeState(m);
  const toggleMode = () => setModeState((m) => (m === 'dark' ? 'light' : 'dark'));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  const value = useMemo<ThemeState>(() => ({ mode, setMode, toggleMode }), [mode]);
  const themeConfig = useMemo(() => getLinkTuneTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={themeConfig}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
}
