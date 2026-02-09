import type { CustomPlatform } from '../../../protocols/custom/library';

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return Boolean(v) && typeof v === 'object';
}

export function getPlaylistState(locationState: unknown, playlistId: string): {
  customPlatform: CustomPlatform;
  playlistName: string;
} {
  const state = isRecord(locationState) ? locationState : null;

  const customPlatform = String(state?.platform ?? state?.source ?? playlistId) as CustomPlatform;
  const playlistName = typeof state?.playlistName === 'string' ? state.playlistName : '';

  return { customPlatform, playlistName };
}
