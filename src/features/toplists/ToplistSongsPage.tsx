import { ArrowLeftOutlined, CaretRightFilled, EllipsisOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Dropdown, Space, Tag, Typography, message, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useIsMobile } from '../../hooks/useIsMobile';

import { CUSTOM_PLAYLISTS } from '../../app/shell/customPlaylists';
import { buildCustomAudioUrl, customParseSongs, type CustomPlatform, type CustomSong } from '../../protocols/custom/library';
import { loadAudioQuality } from '../../config/audioQualityConfig';
import { customGetToplistSongs } from '../../protocols/custom/toplists';
import { usePlayer } from '../../player/PlayerContext';
import type { Track } from '../../player/types';
import { useAuth } from '../../session/AuthProvider';
import { SongsTable } from '../library/components/SongsTable';
import { AddToPlaylistModal } from '../local-playlists/AddToPlaylistModal';
import type { LocalPlaylistSong } from '../local-playlists/localPlaylistDB';
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
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const location = useLocation();
  const { source: rawSource, toplistId: rawToplistId } = useParams();

  const source = typeof rawSource === 'string' ? (rawSource as CustomPlatform) : 'netease';
  const toplistId = typeof rawToplistId === 'string' ? rawToplistId : '';

  const state = isRecord(location.state) ? location.state : null;
  const toplistName = typeof state?.toplistName === 'string' ? state.toplistName : '';

  const [songs, setSongs] = useState<CustomSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [tableBodyY, setTableBodyY] = useState<number>(420);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [songToAdd, setSongToAdd] = useState<LocalPlaylistSong | null>(null);

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
    if (c.protocol === 'custom') return 'TuneHub';
    try {
      const host = new URL(c.baseUrl).host;
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

    customGetToplistSongs({ credentials: c, platform: source, toplistId, signal: controller.signal })
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

      const quality = loadAudioQuality(c.protocol);
      const platform = row.platform || source;

      // buildUrl 需要异步调用解析接口
      const buildUrl = async (q: typeof quality): Promise<string> => {
        // 如果歌曲本身有 URL，直接返回
        const syncUrl = buildCustomAudioUrl({
          credentials: c,
          song: row,
          platform,
          quality: q,
        });
        if (syncUrl) return syncUrl;

        // 否则调用解析接口
        const parsed = await customParseSongs({
          credentials: c,
          platform,
          ids: row.id,
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
        id: row.id,
        title: row.name,
        artist: joinArtists(row.artists),
        url: '', // 需要异步获取
        protocol: c.protocol,
        quality,
        buildUrl,
        platform,
        artists: row.artists,
        coverUrl: row.cover,
      };
    },
    [auth.credentials, source],
  );

  const handleAddToPlaylist = useCallback((row: CustomSong) => {
    setSongToAdd({
      id: row.id,
      name: row.name,
      artists: row.artists,
      platform: row.platform || source,
      addedAt: Date.now(),
    });
    setAddModalOpen(true);
  }, [source]);

  // 歌曲项的更多菜单
  const getSongMenu = useCallback((song: CustomSong): MenuProps => ({
    items: [
      { key: 'add', label: '添加到歌单', icon: <PlusOutlined /> },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'add') {
        handleAddToPlaylist(song);
      } else {
        message.info(`${key}（功能占位）`);
      }
    },
  }), [handleAddToPlaylist]);

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
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={() => handleAddToPlaylist(row as CustomSong)}
                title="添加到歌单"
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
  }, [buildTrack, handleAddToPlaylist, player, token.colorText, token.colorTextSecondary]);

  const sourceLabel = labelForSource(source);
  const pageTitle = toplistName ? `榜单 · ${toplistName}` : `榜单 · ${sourceLabel}`;

  // 返回榜单列表页
  const handleGoBack = useCallback(() => {
    navigate(`/toplists/${source}`);
  }, [navigate, source]);

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
    return (
      <div className={isMobile ? 'mobile-page' : 'linktune-page'}>
        <Alert type="warning" showIcon message="榜单歌曲页仅支持 TuneHub 协议" style={{ borderRadius: 12 }} />
      </div>
    );
  }

  // 移动端布局
  if (isMobile) {
    return (
      <div className="mobile-page">
        {/* 返回按钮 */}
        <div className="mobile-page__back-header">
          <button type="button" className="mobile-page__back-btn" onClick={handleGoBack}>
            <ArrowLeftOutlined />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="mobile-page__title" style={{ fontSize: 20 }}>
              {toplistName || sourceLabel}
            </h1>
          </div>
        </div>

        {error && <Alert type="error" showIcon message={error} style={{ borderRadius: 12, marginBottom: 16 }} />}

        {loading ? (
          <div className="mobile-loading">
            <div className="mobile-loading__spinner" />
          </div>
        ) : songs.length === 0 ? (
          <div className="mobile-empty">
            <div className="mobile-empty__icon">🎵</div>
            <h3 className="mobile-empty__title">暂无歌曲</h3>
            <p className="mobile-empty__desc">榜单歌曲加载中或为空</p>
          </div>
        ) : (
          <>
            {/* 列表工具栏 */}
            <div className="mobile-list-toolbar">
              <span className="mobile-list-toolbar__info">{songs.length} 首歌曲</span>
              <div className="mobile-list-toolbar__actions">
                <button type="button" className="mobile-list-toolbar__btn mobile-list-toolbar__btn--primary" onClick={handlePlayAll}>
                  <CaretRightFilled /> 播放全部
                </button>
              </div>
            </div>

            {/* 歌曲列表 */}
            <div className="mobile-song-list">
              {songs.map((song, index) => {
                const isCurrent = player.currentTrack?.id === song.id;
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

                    {/* 封面 */}
                    <div className="mobile-song-item__cover">
                      {song.cover ? (
                        <img src={song.cover} alt={song.name} />
                      ) : (
                        <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>🎵</span>
                      )}
                    </div>

                    {/* 信息 */}
                    <div className="mobile-song-item__info">
                      <p className="mobile-song-item__title">{song.name}</p>
                      <div className="mobile-song-item__meta">
                        <p className="mobile-song-item__artist">{joinArtists(song.artists)}</p>
                      </div>
                    </div>

                    {/* 更多按钮 */}
                    <Dropdown menu={getSongMenu(song)} trigger={['click']} placement="bottomRight">
                      <div className="mobile-song-item__action" onClick={(e) => e.stopPropagation()}>
                        <EllipsisOutlined />
                      </div>
                    </Dropdown>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <AddToPlaylistModal
          open={addModalOpen}
          onClose={() => { setAddModalOpen(false); setSongToAdd(null); }}
          song={songToAdd}
        />
      </div>
    );
  }

  return (
    <div className="linktune-page linktune-toplistSongs">
      {/* 头部 */}
      <div className="linktune-page__header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={handleGoBack}
              title={`返回${sourceLabel}榜单列表`}
              style={{ borderRadius: 10 }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <Typography.Title level={2} className="linktune-page__title" ellipsis={{ tooltip: pageTitle }} style={{ marginBottom: 4 }}>
                {pageTitle}
              </Typography.Title>
              <Space size={12} wrap>
                {connectionTitle && (
                  <Tag color="blue" style={{ borderRadius: 8 }}>
                    {connectionTitle}
                  </Tag>
                )}
                <Typography.Text type="secondary">
                  已加载 {songs.length.toLocaleString()} 首
                </Typography.Text>
              </Space>
            </div>
          </div>

          <Button
            type="primary"
            onClick={handlePlayAll}
            disabled={songs.length === 0}
            style={{ borderRadius: 10 }}
          >
            播放全部
          </Button>
        </div>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ borderRadius: 12, marginBottom: 16 }} />}

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
