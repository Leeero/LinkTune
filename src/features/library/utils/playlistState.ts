import type { CustomPlaylistSource } from '../../../protocols/custom/library';

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return Boolean(v) && typeof v === 'object';
}

export function getPlaylistState(locationState: unknown, playlistId: string): {
  customSource: CustomPlaylistSource;
  playlistName: string;
} {
  const state = isRecord(locationState) ? locationState : null;

  const customSource = String(state?.source ?? playlistId) as CustomPlaylistSource;
  const playlistName = typeof state?.playlistName === 'string' ? state.playlistName : '';

  return { customSource, playlistName };
}
