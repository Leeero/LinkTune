import { useEffect } from 'react';

import type { EmbyCredentials } from '../../protocols/emby/types';
import type { AuthCredentials } from '../../session/types';
import { usePlaylistsStore } from '../../stores/playlistsStore';

export function useEmbyPlaylists(credentials: AuthCredentials | null) {
  const playlists = usePlaylistsStore((s) => s.embyPlaylists);
  const loading = usePlaylistsStore((s) => s.embyLoading);
  const error = usePlaylistsStore((s) => s.embyError);
  const initialized = usePlaylistsStore((s) => s.embyInitialized);
  const fetchEmbyPlaylists = usePlaylistsStore((s) => s.fetchEmbyPlaylists);
  const resetEmbyPlaylists = usePlaylistsStore((s) => s.resetEmbyPlaylists);

  useEffect(() => {
    if (!credentials || credentials.protocol !== 'emby') {
      resetEmbyPlaylists();
      return;
    }

    // 仅在未初始化时加载（缓存有效则跳过）
    if (!initialized) {
      void fetchEmbyPlaylists(credentials as EmbyCredentials, true);
    }
  }, [credentials, initialized, fetchEmbyPlaylists, resetEmbyPlaylists]);

  return { playlists, loading, error };
}
