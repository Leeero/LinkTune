import { useEffect, useState } from 'react';

import { embyGetPlaylists } from '../../protocols/emby/library';
import type { EmbyPlaylist } from '../../protocols/emby/types';
import type { AuthCredentials } from '../../session/types';

export function useEmbyPlaylists(credentials: AuthCredentials | null) {
  const [playlists, setPlaylists] = useState<EmbyPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!credentials || credentials.protocol !== 'emby') {
      setPlaylists([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    embyGetPlaylists({ credentials, signal: controller.signal })
      .then((list) => {
        if (controller.signal.aborted) return;
        setPlaylists(list);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setPlaylists([]);
        setError(e instanceof Error ? e.message : '加载歌单失败');
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
      });

    return () => controller.abort();
  }, [credentials]);

  return { playlists, loading, error };
}
