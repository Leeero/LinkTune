import { PlayCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Space, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { getMaxBitrate, loadAudioQuality } from '../../config/audioQualityConfig';
import {
  buildCustomAudioUrl,
  customGetPlaylistSongsPage,
  type CustomSong,
} from '../../protocols/custom/library';
import type { EmbySong } from '../../protocols/emby/types';
import { buildEmbyAudioUniversalUrl } from '../../protocols/emby/media';
import { embyGetPlaylistSongsPage, embyGetSongsPage } from '../../protocols/emby/library';
import { usePlayer } from '../../player/PlayerContext';
import type { Track } from '../../player/types';
import { useAuth } from '../../session/AuthProvider';

import { LibraryHeader } from './components/LibraryHeader';
import { SongsTable } from './components/SongsTable';
import { useLibrarySongs } from './hooks/useLibrarySongs';
import type { UnifiedSong } from './types';
import { formatDurationFromSeconds, formatDurationFromTicks, joinArtists } from './utils/format';
import { getPlaylistState } from './utils/playlistState';

export function LibraryPage() {
  const { token } = theme.useToken();
  const auth = useAuth();
  const player = usePlayer();
  const location = useLocation();
  const { playlistId: rawPlaylistId } = useParams();

  const playlistId = typeof rawPlaylistId === 'string' ? rawPlaylistId : '';
  const isPlaylistMode = Boolean(playlistId);

  const { customSource, playlistName } = useMemo(() => {
    return getPlaylistState(location.state, playlistId);
  }, [location.state, playlistId]);

  const {
    searchInput,
    setSearchInput,
    searchTerm,
    commitSearch,
    isEmby,
    isCustom,
    songs,
    total,
    loadingFirstPage,
    error,
    tableWrapRef,
    tableBodyY,
  } = useLibrarySongs({
    credentials: auth.credentials,
    playlistId,
    isPlaylistMode,
    customSource,
  });

  const [playAllLoading, setPlayAllLoading] = useState(false);

  const connectionTitle = useMemo(() => {
    const c = auth.credentials;
    if (!c) return '';
    try {
      const host = new URL(c.baseUrl).host;
      if (c.protocol === 'custom') {
        return `自定义 · ${host}`;
      }
      return `${c.protocol.toUpperCase()} · ${host}${'serverName' in c && c.serverName ? ` · ${c.serverName}` : ''}`;
    } catch {
      return c.protocol.toUpperCase();
    }
  }, [auth.credentials]);

  const pageTitle = isPlaylistMode ? (playlistName ? `歌单 · ${playlistName}` : '歌单') : '歌曲';

  const buildTrack = useCallback(
    (row: UnifiedSong): Track | null => {
      const c = auth.credentials;
      if (!c) return null;

      const artist = joinArtists(row.artists);

      if (c.protocol === 'custom') {
        // 自定义协议
        const customRow = row as CustomSong;
        const url = buildCustomAudioUrl({
          credentials: c,
          song: customRow,
          source: customSource,
        });
        return {
          id: customRow.id,
          title: customRow.name,
          artist,
          url,
        };
      }

      if (c.protocol !== 'emby') return null;

      // Emby 协议
      const embyRow = row as EmbySong;
      const quality = loadAudioQuality();
      const maxBitrate = getMaxBitrate(quality);
      const url = buildEmbyAudioUniversalUrl({
        credentials: c,
        itemId: embyRow.id,
        maxStreamingBitrate: maxBitrate,
      });
      return {
        id: embyRow.id,
        title: embyRow.name,
        artist,
        url,
      };
    },
    [auth.credentials, customSource],
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
                    {'productionYear' in row && row.productionYear ? ` · ${row.productionYear}` : ''}
                  </Typography.Text>
                </div>
              </div>
            </Space>
          );
        },
      },
      {
        title: '专辑',
        dataIndex: 'album',
        key: 'album',
        width: 280,
        ellipsis: true,
        render: (v: unknown) => (
          <Typography.Text style={{ color: token.colorTextSecondary }}>{typeof v === 'string' ? v : ''}</Typography.Text>
        ),
      },
      {
        title: '时长',
        dataIndex: isCustom ? 'duration' : 'runTimeTicks',
        key: 'duration',
        width: 90,
        align: 'right',
        render: (_: unknown, row) => {
          if (isCustom) {
            const customRow = row as CustomSong;
            return (
              <Typography.Text style={{ color: token.colorTextSecondary }}>
                {formatDurationFromSeconds(customRow.duration)}
              </Typography.Text>
            );
          }
          const embyRow = row as EmbySong;
          return (
            <Typography.Text style={{ color: token.colorTextSecondary }}>
              {formatDurationFromTicks(embyRow.runTimeTicks)}
            </Typography.Text>
          );
        },
      },
    ];
  }, [buildTrack, isCustom, player, token.colorText, token.colorTextSecondary]);

  const c = auth.credentials;

  const handlePlayAll = useCallback(async () => {
    if (!c) return;
    if (c.protocol !== 'emby' && c.protocol !== 'custom') return;
    if (songs.length === 0) return;

    setPlayAllLoading(true);

    const seen = new Set<string>();
    const initialTracks = songs
      .map((s) => {
        const t = buildTrack(s);
        if (!t) return null;
        if (seen.has(t.id)) return null;
        seen.add(t.id);
        return t;
      })
      .filter(Boolean) as Track[];

    await player.playTracks(initialTracks, 0);

    // 大列表优化：先用已加载的歌曲启动播放，再在空闲/下一拍逐步补齐剩余队列
    if (total > songs.length) {
      let startIndex = songs.length;
      const limit = 200;
      while (startIndex < total) {
        try {
          if (c.protocol === 'custom') {
            const res = await customGetPlaylistSongsPage({
              credentials: c,
              source: customSource,
              startIndex,
              limit,
            });

            const chunkTracks = res.items
              .map((s) => {
                const t = buildTrack(s);
                if (!t) return null;
                if (seen.has(t.id)) return null;
                seen.add(t.id);
                return t;
              })
              .filter(Boolean) as Track[];

            if (chunkTracks.length) player.appendTracks(chunkTracks);
            if (res.items.length === 0) break;
            startIndex += res.items.length;
          } else {
            const res = isPlaylistMode
              ? await embyGetPlaylistSongsPage({
                  credentials: c,
                  playlistId,
                  startIndex,
                  limit,
                  searchTerm: searchTerm || undefined,
                })
              : await embyGetSongsPage({
                  credentials: c,
                  startIndex,
                  limit,
                  searchTerm: searchTerm || undefined,
                });

            const chunkTracks = res.items
              .map((s) => {
                const t = buildTrack(s);
                if (!t) return null;
                if (seen.has(t.id)) return null;
                seen.add(t.id);
                return t;
              })
              .filter(Boolean) as Track[];

            if (chunkTracks.length) player.appendTracks(chunkTracks);
            if (res.items.length === 0) break;
            startIndex += res.items.length;
          }

          await new Promise((r) => window.setTimeout(r, 0));
        } catch {
          break;
        }
      }
    }

    setPlayAllLoading(false);
  }, [buildTrack, c, customSource, isPlaylistMode, player, playlistId, searchTerm, songs, total]);

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Card
        style={{ height: '100%' }}
        styles={{
          body: {
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <LibraryHeader
            pageTitle={pageTitle}
            connectionTitle={connectionTitle}
            isEmby={isEmby}
            isCustom={isCustom}
            songsCount={songs.length}
            total={total}
            isPlaylistMode={isPlaylistMode}
            searchInput={searchInput}
            onSearchInputChange={(v) => setSearchInput(v)}
            onSearchCommit={commitSearch}
            playAllLoading={playAllLoading}
            playAllDisabled={(!isEmby && !isCustom) || songs.length === 0}
            onPlayAll={() => void handlePlayAll()}
          />

          {c?.protocol === 'navidrome' ? (
            <Alert
              type="info"
              showIcon
              message="当前仅完善了 Emby 的歌曲列表"
              description="Navidrome 的歌曲列表接口后续再接入；你可以先切到 Emby 体验歌曲列表与播放。"
            />
          ) : null}

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <SongsTable
            tableWrapRef={tableWrapRef}
            songs={songs}
            columns={columns}
            loading={loadingFirstPage}
            tableBodyY={tableBodyY}
            onRowDoubleClick={async (record) => {
              const t = buildTrack(record);
              if (!t) return;
              await player.playTrack(t);
            }}
          />

        </div>
      </Card>
    </div>
  );
}
