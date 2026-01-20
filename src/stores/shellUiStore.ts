import { create } from 'zustand';

type ShellUiState = {
  openKeys: string[];
  setOpenKeys: (keys: string[]) => void;
  ensureOpen: (key: string) => void;
};

function getInitialOpenKeys(): string[] {
  if (typeof window === 'undefined') return [];

  // HashRouter: location 通常是 #/path...
  const hash = window.location.hash || '';
  const path = hash.startsWith('#') ? hash.slice(1) : hash;

  if (path.startsWith('/playlists/')) return ['/playlists'];
  return [];
}

export const useShellUiStore = create<ShellUiState>((set) => ({
  openKeys: getInitialOpenKeys(),
  setOpenKeys: (keys) => set({ openKeys: keys }),
  ensureOpen: (key) =>
    set((s) => {
      if (s.openKeys.includes(key)) return s;
      return { openKeys: [...s.openKeys, key] };
    }),
}));
