import { DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Popconfirm, Space, Tag, Typography, message, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { CUSTOM_PLAYLISTS } from '../../app/shell/customPlaylists';
import { loadAudioQuality } from '../../config/audioQualityConfig';
import { usePlayer } from '../../player/PlayerContext';
import type { Track } from '../../player/types';
import { buildCustomAudioUrl } from '../../protocols/custom/library';
import { useAuth } from '../../session/AuthProvider';
import { SongsTable } from '../library/components/SongsTable';
import { joinArtists } from '../library/utils/format';
import {
  getLocalPlaylist,
  removeSongFromPlaylist,
  type LocalPlaylist,
  type LocalPlaylistSong,
} from './localPlaylistDB';

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return Boolean(v) && typeof v === 'object';
}

function labelForSource(source: string) {
  return CUSTOM_PLAYLISTS.find((p) => p.id === source)?.name ?? source;
}

export function LocalPlaylistDetailPage() {
  const { token } = theme.useToken();
  const auth = useAuth();
  const player = usePlayer();

  const location = useLocation();
  const { playlistId } = useParams();

  const state = isRecord(location.state) ? location.state : null;
  const passedName = typeof state?.playlistName === 'string' ? state.playlistName : '';
  const autoPlay = state?.autoPlay === true;

  const [playlist, setPlaylist] = useState<LocalPlaylist | null>(null);
  const [loading, setLoading] = useState(true);

  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [tableBodyY, setTableBodyY] = useState<number>(420);

  const autoPlayTriggeredRef = useRef(false);

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

  const refresh = useCallback(async () => {
    if (!playlistId) {
      setPlaylist(null);
      setLoading(false);
      return;
    }
    const p = await getLocalPlaylist(playlistId);
    setPlaylist(p);
    setLoading(false);
  }, [playlistId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const buildTrack = useCallback(
    (song: LocalPlaylistSong): Track | null => {
      const c = auth.credentials;
      if (!c || c.protocol !== 'custom') return null;

      const quality = loadAudioQuality(c.protocol);
      const buildUrl = (q: typeof quality) =>
        buildCustomAudioUrl({
          credentials: c,
          song: { id: song.id, name: song.name, artists: song.artists },
          source: song.source as 'netease' | 'kugou' | 'kuwo',
          quality: q,
        });
      const url = buildUrl(quality);

      return {
        id: `${song.source}:${song.id}`,
        title: song.name,
        artist: joinArtists(song.artists),
        url,
        protocol: c.protocol,
        quality,
        buildUrl,
      };
    },
    [auth.credentials],
  );

  const handlePlayAll = useCallback(async () => {
    if (!playlist || playlist.songs.length === 0) return;

    const seen = new Set<string>();
    const tracks = playlist.songs
      .map((s) => {
        const t = buildTrack(s);
        if (!t) return null;
        if (seen.has(t.id)) return null;
        seen.add(t.id);
        return t;
      })
      .filter(Boolean) as Track[];

    if (tracks.length > 0) {
      await player.playTracks(tracks, 0);
    }
  }, [buildTrack, player, playlist]);

  // 自动播放
  useEffect(() => {
    if (autoPlay && playlist && playlist.songs.length > 0 && !autoPlayTriggeredRef.current) {
      autoPlayTriggeredRef.current = true;
      void handlePlayAll();
    }
  }, [autoPlay, handlePlayAll, playlist]);

  const handleRemoveSong = useCallback(
    async (song: LocalPlaylistSong) => {
      if (!playlistId) return;
      await removeSongFromPlaylist(playlistId, song.id, song.source);
      await refresh();
      message.success('已从歌单移除');
    },
    [playlistId, refresh],
  );

  const columns: ColumnsType<LocalPlaylistSong> = useMemo(() => {
    return [
      {
        title: '歌曲',
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        render: (_: unknown, row) => {
          const trackId = `${row.source}:${row.id}`;
          const isCurrent = player.currentTrack?.id === trackId;
          const artist = joinArtists(row.artists);

          return (
            <Space size={10} style={{ minWidth: 0 }}>
              <Button
                type={isCurrent ? 'primary' : 'text'}
                icon={<PlayCircleOutlined />}
                onClick={async () => {
                  const t = buildTrack(row);
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
      {
        title: '来源',
        dataIndex: 'source',
        key: 'source',
        width: 100,
        render: (source: string) => <Tag>{labelForSource(source)}</Tag>,
      },
      {
        title: '操作',
        key: 'actions',
        width: 80,
        render: (_: unknown, row) => (
          <Popconfirm
            title="确定从歌单移除这首歌吗？"
            onConfirm={() => void handleRemoveSong(row)}
            okText="移除"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ),
      },
    ];
  }, [buildTrack, handleRemoveSong, player, token.colorText, token.colorTextSecondary]);

  if (loading) {
    return null;
  }

  if (!playlist) {
    return <Alert type="warning" showIcon message="歌单不存在或已被删除" />;
  }

  const pageTitle = passedName || playlist.name;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'nowrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Typography.Title level={3} ellipsis={{ tooltip: pageTitle }} style={{ marginBottom: 0 }}>
            {pageTitle}
          </Typography.Title>
          <Space size={8} wrap style={{ marginTop: 6 }}>
            <Tag color="green">本地歌单</Tag>
            <Typography.Text type="secondary">{playlist.songs.length} 首歌曲</Typography.Text>
          </Space>
        </div>

        <Button type="primary" style={{ flex: '0 0 auto' }} onClick={handlePlayAll} disabled={playlist.songs.length === 0}>
          播放全部
        </Button>
      </div>

      <SongsTable
        tableWrapRef={tableWrapRef}
        songs={playlist.songs}
        columns={columns}
        loading={false}
        tableBodyY={tableBodyY}
        rowKey={(row) => `${row.source}:${row.id}`}
        onRowDoubleClick={async (row) => {
          const t = buildTrack(row as LocalPlaylistSong);
          if (!t) return;
          await player.playTrack(t);
        }}
      />
    </div>
  );
}
