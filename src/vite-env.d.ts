/// <reference types="vite/client" />

declare global {
  interface Window {
    linkTune?: {
      platform: string;
      versions: { node: string; chrome: string; electron: string };
    };
  }
}

export {};
