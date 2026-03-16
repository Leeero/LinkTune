import { CaretRightFilled, EllipsisOutlined, PlayCircleOutlined, PlusOutlined, SearchOutlined, CloseCircleFilled } from '@ant-design/icons';
import { Alert, Button, Card, Dropdown, Space, Typography, message, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { getMaxBitrate, loadAudioQuality } from '../../config/audioQualityConfig';
import {
  buildCustomAudioUrl,
  customParseSongs,
  type CustomSong,
} from '../../protocols/custom/library';
import { customSearchSongs } from '../../protocols/custom/search';
import type { EmbySong } from '../../protocols/emby/types';
import { buildEmbyAudioUniversalUrl } from '../../protocols/emby/media';
import { embyGetPlaylistSongsPage, embyGetSongsPage } from '../../protocols/emby/library';
import { usePlayer } from '../../player/PlayerContext';
import type { Track } from '../../player/types';
import { useAuth } from '../../session/AuthProvider';
import { useIsMobile } from '../../hooks/useIsMobile';
import { AddToPlaylistModal } from '../local-playlists/AddToPlaylistModal';
import type { LocalPlaylistSong } from '../local-playlists/localPlaylistDB';

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
  const isMobile = useIsMobile();
  const mobileListRef = useRef<HTMLDivElement>(null);

  const playlistId = typeof rawPlaylistId === 'string' ? rawPlaylistId : '';
  const isPlaylistMode = Boolean(playlistId);

  // 添加到歌单弹窗状态
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [songToAdd, setSongToAdd] = useState<LocalPlaylistSong | null>(null);

  const { customPlatform, playlistName } = useMemo(() => {
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
    loadingMore,
    hasMore,
    error,
    tableWrapRef,
    tableBodyY,
    loadSongsChunk,
  } = useLibrarySongs({
    credentials: auth.credentials,
    playlistId,
    isPlaylistMode,
    customPlatform,
  });

  const [playAllLoading, setPlayAllLoading] = useState(false);

  const connectionTitle = useMemo(() => {
    const c = auth.credentials;
    if (!c) return '';
    if (c.protocol === 'custom') {
      return 'TuneHub';
    }
    try {
      const host = new URL(c.baseUrl).host;
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
        // 自定义协议：使用异步解析获取播放 URL
        const customRow = row as CustomSong;
        const quality = loadAudioQuality(c.protocol);
        const platform = customRow.platform || customPlatform;

        // buildUrl 需要异步调用解析接口
        const buildUrl = async (q: typeof quality): Promise<string> => {
          // 如果歌曲本身有 URL，直接返回
          const syncUrl = buildCustomAudioUrl({
            credentials: c,
            song: customRow,
            platform,
            quality: q,
          });
          if (syncUrl) return syncUrl;

          // 否则调用解析接口
          const parsed = await customParseSongs({
            credentials: c,
            platform,
            ids: customRow.id,
            quality: q,
          });
          
          if (parsed.length === 0) {
            throw new Error('无法获取播放链接');
          }
          
          const result = parsed[0];
          if (!result.success || !result.url) {
            throw new Error('无法获取播放链接');
          }
          
          return result.url;
        };

        return {
          id: customRow.id,
          title: customRow.name,
          artist,
          url: '', // 需要异步获取
          protocol: c.protocol,
          quality,
          buildUrl,
          platform,
          coverUrl: customRow.cover,
        };
      }

      if (c.protocol !== 'emby') return null;

      // Emby 协议
      const embyRow = row as EmbySong;
      const quality = loadAudioQuality(c.protocol);
      const buildUrl = (q: typeof quality) =>
        buildEmbyAudioUniversalUrl({
          credentials: c,
          itemId: embyRow.id,
          maxStreamingBitrate: getMaxBitrate(c.protocol, q),
        });
      const url = buildUrl(quality);
      return {
        id: embyRow.id,
        title: embyRow.name,
        artist,
        url,
        protocol: c.protocol,
        quality,
        buildUrl,
      };
    },
    [auth.credentials, customPlatform],
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
    if (total > songs.length && c.protocol === 'emby') {
      // 仅对 Emby 协议进行增量加载，custom 协议基于搜索，已一次性返回
      let startIndex = songs.length;
      const limit = 200;
      while (startIndex < total) {
        try {
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

          await new Promise((r) => window.setTimeout(r, 0));
        } catch {
          break;
        }
      }
    } else if (total > songs.length && c.protocol === 'custom' && searchTerm) {
      // Custom 协议：继续搜索加载更多
      let page = Math.floor(songs.length / 30) + 2; // 从下一页开始
      const pageSize = 30;
      let startIndex = songs.length;
      while (startIndex < total) {
        try {
          const res = await customSearchSongs({
            credentials: c,
            platform: customPlatform,
            keyword: searchTerm,
            page,
            pageSize,
          });

          const chunkTracks = res.songs
            .map((s) => {
              const t = buildTrack({ ...s, platform: customPlatform });
              if (!t) return null;
              if (seen.has(t.id)) return null;
              seen.add(t.id);
              return t;
            })
            .filter(Boolean) as Track[];

          if (chunkTracks.length) player.appendTracks(chunkTracks);
          if (res.songs.length === 0) break;
          startIndex += res.songs.length;
          page += 1;

          await new Promise((r) => window.setTimeout(r, 0));
        } catch {
          break;
        }
      }
    }

    setPlayAllLoading(false);
  }, [buildTrack, c, customPlatform, isPlaylistMode, player, playlistId, searchTerm, songs, total]);

  // 添加到歌单
  const handleAddToPlaylist = useCallback(
    (row: UnifiedSong) => {
      const songPlatform = 'platform' in row ? (row as CustomSong).platform : undefined;
      setSongToAdd({
        id: row.id,
        name: row.name,
        artists: row.artists,
        platform: songPlatform || customPlatform,
        addedAt: Date.now(),
      });
      setAddModalOpen(true);
    },
    [customPlatform],
  );

  // 移动端歌曲更多菜单
  const getSongMenu = useCallback(
    (song: UnifiedSong): MenuProps => ({
      items: [
        { key: 'add', label: '添加到歌单', icon: <PlusOutlined /> },
        { key: 'next', label: '下一首播放' },
      ],
      onClick: ({ key }: { key: string }) => {
        if (key === 'add') {
          handleAddToPlaylist(song);
        } else {
          message.info(`${key}（功能占位）`);
        }
      },
    }),
    [handleAddToPlaylist],
  );

  // 移动端滚动加载更多
  useEffect(() => {
    if (!isMobile) return;
    const el = mobileListRef.current;
    if (!el) return;

    // 实际滚动容器是 .linktune-content__scroll，而非 window
    const scrollContainer = el.closest('.linktune-content__scroll') as HTMLElement | null;
    if (!scrollContainer) return;

    const onScroll = () => {
      if (!isEmby && !isCustom) return;
      if (loadingFirstPage || loadingMore) return;
      if (!hasMore) return;

      const threshold = 300;
      const distanceToBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
      if (distanceToBottom < threshold) {
        void loadSongsChunk({ reset: false });
      }
    };

    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', onScroll);
  }, [isMobile, isEmby, isCustom, loadingFirstPage, loadingMore, hasMore, loadSongsChunk]);

  // 移动端布局
  if (isMobile) {
    const getDuration = (row: UnifiedSong) => {
      if (isCustom) {
        return formatDurationFromSeconds((row as CustomSong).duration);
      }
      return formatDurationFromTicks((row as EmbySong).runTimeTicks);
    };

    return (
      <div className="mobile-page">
        {/* 页面标题 */}
        <div className="mobile-page__header">
          <h1 className="mobile-page__title">{pageTitle}</h1>
          {connectionTitle && (
            <p className="mobile-page__subtitle">{connectionTitle}</p>
          )}
        </div>

        {/* Navidrome 提示 */}
        {c?.protocol === 'navidrome' && (
          <Alert
            type="info"
            showIcon
            message="当前仅完善了 Emby 的歌曲列表"
            description="Navidrome 的歌曲列表接口后续再接入。"
            style={{ borderRadius: 12, marginBottom: 16 }}
          />
        )}

        {/* 搜索栏（仅 Emby） */}
        {!isCustom && (
          <div className="mobile-search-bar">
            <SearchOutlined className="mobile-search-bar__icon" />
            <input
              type="search"
              className="mobile-search-bar__input"
              placeholder={isPlaylistMode ? '搜索歌单内歌曲...' : '搜索歌曲 / 歌手 / 专辑'}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitSearch();
              }}
              enterKeyHint="search"
            />
            {searchInput && (
              <button
                type="button"
                className="mobile-search-bar__clear"
                onClick={() => setSearchInput('')}
              >
                <CloseCircleFilled />
              </button>
            )}
          </div>
        )}

        {/* 错误提示 */}
        {error && <Alert type="error" showIcon message={error} style={{ borderRadius: 12, marginBottom: 16 }} />}

        {/* 列表工具栏 */}
        {(isEmby || isCustom) && songs.length > 0 && (
          <div className="mobile-list-toolbar">
            <span className="mobile-list-toolbar__info">
              已加载 {songs.length.toLocaleString()} / {total.toLocaleString()} 首
            </span>
            <div className="mobile-list-toolbar__actions">
              <button
                type="button"
                className="mobile-list-toolbar__btn mobile-list-toolbar__btn--primary"
                onClick={() => void handlePlayAll()}
                disabled={playAllLoading}
              >
                <CaretRightFilled /> {playAllLoading ? '加载中...' : '播放全部'}
              </button>
            </div>
          </div>
        )}

        {/* 加载中 */}
        {loadingFirstPage ? (
          <div className="mobile-loading">
            <div className="mobile-loading__spinner" />
          </div>
        ) : songs.length === 0 && !error ? (
          <div className="mobile-empty">
            <div className="mobile-empty__icon">🎵</div>
            <h3 className="mobile-empty__title">暂无歌曲</h3>
            <p className="mobile-empty__desc">
              {isCustom ? '请先搜索歌曲' : '加载歌曲中...'}
            </p>
          </div>
        ) : (
          /* 歌曲列表 */
          <div className="mobile-song-list" ref={mobileListRef}>
            {songs.map((song, index) => {
              const isCurrent = player.currentTrack?.id === song.id;
              const artist = joinArtists(song.artists);
              const cover = 'cover' in song ? (song as CustomSong).cover : undefined;
              const duration = getDuration(song);

              return (
                <button
                  key={song.id}
                  type="button"
                  className={`mobile-song-item ${isCurrent ? 'is-playing' : ''}`}
                  onClick={async () => {
                    const t = buildTrack(song);
                    if (t) await player.playTrack(t);
                  }}
                >
                  {/* 序号 / 播放动画 */}
                  {isCurrent ? (
                    <div className="mobile-song-item__playing-indicator">
                      <span /><span /><span />
                    </div>
                  ) : (
                    <span className="mobile-song-item__index">{index + 1}</span>
                  )}

                  {/* 封面（Custom协议有封面时显示） */}
                  {cover && (
                    <div className="mobile-song-item__cover">
                      <img src={cover} alt={song.name} />
                    </div>
                  )}

                  {/* 信息 */}
                  <div className="mobile-song-item__info">
                    <p className="mobile-song-item__title">{song.name}</p>
                    <div className="mobile-song-item__meta">
                      <p className="mobile-song-item__artist">
                        {artist}
                        {duration !== '--:--' ? ` · ${duration}` : ''}
                        {'album' in song && song.album ? ` · ${song.album}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* 更多按钮 */}
                  <Dropdown menu={getSongMenu(song)} trigger={['click']} placement="bottomRight">
                    <div
                      className="mobile-song-item__action"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <EllipsisOutlined />
                    </div>
                  </Dropdown>
                </button>
              );
            })}

            {/* 加载更多指示器 */}
            {loadingMore && (
              <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'center' }}>
                <div className="mobile-loading__spinner" />
              </div>
            )}
            {!hasMore && songs.length > 0 && (
              <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 13, color: 'var(--lt-text-secondary, rgba(255,255,255,0.4))' }}>
                已加载全部 {total.toLocaleString()} 首
              </div>
            )}
          </div>
        )}

        <AddToPlaylistModal
          open={addModalOpen}
          onClose={() => {
            setAddModalOpen(false);
            setSongToAdd(null);
          }}
          song={songToAdd}
        />
      </div>
    );
  }

  // 桌面端布局
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
