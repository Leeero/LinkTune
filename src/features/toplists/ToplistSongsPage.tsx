import { PlayCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Space, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { CUSTOM_PLAYLISTS } from '../../app/shell/customPlaylists';
import { buildCustomAudioUrl, type CustomSong } from '../../protocols/custom/library';
import type { CustomPlaylistSource } from '../../protocols/custom/library';
import { customGetToplistSongs } from '../../protocols/custom/toplists';
import { usePlayer } from '../../player/PlayerContext';
import type { Track } from '../../player/types';
import { useAuth } from '../../session/AuthProvider';
import { SongsTable } from '../library/components/SongsTable';
import type { UnifiedSong } from '../library/types';
import { joinArtists } from '../library/utils/format';

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return Boolean(v) && typeof v === 'object';
}

function labelForSource(source: string) {
  return CUSTOM_PLAYLISTS.find((p) => p.id === source)?.name ?? source;
}

export function ToplistSongsPage() {
  const { token } = theme.useToken();
  const auth = useAuth();
  const player = usePlayer();

  const location = useLocation();
  const { source: rawSource, toplistId: rawToplistId } = useParams();

  const source = typeof rawSource === 'string' ? (rawSource as CustomPlaylistSource) : 'netease';
  const toplistId = typeof rawToplistId === 'string' ? rawToplistId : '';

  const state = isRecord(location.state) ? location.state : null;
  const toplistName = typeof state?.toplistName === 'string' ? state.toplistName : '';

  const [songs, setSongs] = useState<CustomSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [tableBodyY, setTableBodyY] = useState<number>(420);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      const bodyY = Math.max(220, Math.floor(h - 60));
      setTableBodyY(bodyY);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const connectionTitle = useMemo(() => {
    const c = auth.credentials;
    if (!c) return '';
    try {
      const host = new URL(c.baseUrl).host;
      if (c.protocol === 'custom') return `自定义 · ${host}`;
      return `${c.protocol.toUpperCase()} · ${host}`;
    } catch {
      return c.protocol.toUpperCase();
    }
  }, [auth.credentials]);

  useEffect(() => {
    const c = auth.credentials;
    if (!c || c.protocol !== 'custom') return;
    if (!toplistId) return;

    let alive = true;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    customGetToplistSongs({ credentials: c, source, toplistId, signal: controller.signal })
      .then((list) => {
        if (!alive) return;
        setSongs(list);
      })
      .catch((e) => {
        if (!alive) return;
        // 请求取消不算错误
        if (controller.signal.aborted) return;
        const msg = e instanceof Error ? e.message : '获取榜单歌曲失败';
        setError(msg);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [auth.credentials, source, toplistId]);

  const buildTrack = useCallback(
    (row: CustomSong): Track | null => {
      const c = auth.credentials;
      if (!c || c.protocol !== 'custom') return null;

      const url = buildCustomAudioUrl({
        credentials: c,
        song: row,
        source,
      });

      return {
        id: row.id,
        title: row.name,
        artist: joinArtists(row.artists),
        url,
      };
    },
    [auth.credentials, source],
  );

  const columns: ColumnsType<UnifiedSong> = useMemo(() => {
    return [
      {
        title: '歌曲',
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        render: (_: unknown, row) => {
          const isCurrent = player.currentTrack?.id === row.id;
          const artist = joinArtists(row.artists);

          return (
            <Space size={10} style={{ minWidth: 0 }}>
              <Button
                type={isCurrent ? 'primary' : 'text'}
                icon={<PlayCircleOutlined />}
                onClick={async () => {
                  const t = buildTrack(row as CustomSong);
                  if (!t) return;
                  await player.playTrack(t);
                }}
              />

              <div style={{ minWidth: 0 }}>
                <Typography.Text strong style={{ color: token.colorText }} ellipsis>
                  {row.name}
                </Typography.Text>
                <div>
                  <Typography.Text style={{ color: token.colorTextSecondary }} ellipsis>
                    {artist}
                  </Typography.Text>
                </div>
              </div>
            </Space>
          );
        },
      },
    ];
  }, [buildTrack, player, token.colorText, token.colorTextSecondary]);

  const sourceLabel = labelForSource(source);
  const pageTitle = toplistName ? `榜单 · ${toplistName}` : `榜单 · ${sourceLabel}`;

  const handlePlayAll = useCallback(async () => {
    const c = auth.credentials;
    if (!c || c.protocol !== 'custom') return;
    if (songs.length === 0) return;

    const seen = new Set<string>();
    const tracks = songs
      .map((s) => {
        const t = buildTrack(s);
        if (!t) return null;
        if (seen.has(t.id)) return null;
        seen.add(t.id);
        return t;
      })
      .filter(Boolean) as Track[];

    await player.playTracks(tracks, 0);
  }, [auth.credentials, buildTrack, player, songs]);

  if (!auth.credentials || auth.credentials.protocol !== 'custom') {
    return <Alert type="warning" showIcon message="榜单歌曲页仅支持自定义协议" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'nowrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Typography.Title level={3} ellipsis={{ tooltip: pageTitle }} style={{ marginBottom: 0 }}>
            {pageTitle}
          </Typography.Title>
          <Space size={8} wrap style={{ marginTop: 6 }}>
            {connectionTitle ? <Tag color="blue">{connectionTitle}</Tag> : null}
            <Typography.Text type="secondary">已加载 {songs.length.toLocaleString()} 首</Typography.Text>
          </Space>
        </div>

        <Button type="primary" style={{ flex: '0 0 auto' }} onClick={handlePlayAll} disabled={songs.length === 0}>
          播放全部
        </Button>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <SongsTable
        tableWrapRef={tableWrapRef}
        songs={songs}
        columns={columns}
        loading={loading}
        tableBodyY={tableBodyY}
        onRowDoubleClick={async (row) => {
          const t = buildTrack(row as CustomSong);
          if (!t) return;
          await player.playTrack(t);
        }}
      />
    </div>
  );
}
