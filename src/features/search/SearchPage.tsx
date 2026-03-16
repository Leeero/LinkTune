import { CaretRightFilled, CloseCircleFilled, EllipsisOutlined, PlayCircleOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Spin, Typography, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import { useCallback, useRef, useState } from 'react';

import { loadAudioQuality } from '../../config/audioQualityConfig';
import { useIsMobile } from '../../hooks/useIsMobile';
import { usePlayer } from '../../player/PlayerContext';
import type { Track } from '../../player/types';
import { buildCustomAudioUrl, customParseSongs, type CustomPlatform, type CustomSong } from '../../protocols/custom/library';
import { customSearchSongs, type SearchResult } from '../../protocols/custom/search';
import { useAuth } from '../../session/AuthProvider';
import { joinArtists } from '../library/utils/format';
import { AddToPlaylistModal } from '../local-playlists/AddToPlaylistModal';
import type { LocalPlaylistSong } from '../local-playlists/localPlaylistDB';

const PLATFORM_OPTIONS: Array<{
  id: CustomPlatform;
  name: string;
  icon: string;
  gradient: string;
}> = [
  { id: 'netease', name: '网易云', icon: '🎵', gradient: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' },
  { id: 'qq', name: 'QQ音乐', icon: '🎧', gradient: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)' },
  { id: 'kuwo', name: '酷我', icon: '🎤', gradient: 'linear-gradient(135deg, #f39c12 0%, #d68910 100%)' },
];

export function SearchPage() {
  const auth = useAuth();
  const player = usePlayer();
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);

  const [keyword, setKeyword] = useState('');
  const [platform, setPlatform] = useState<CustomPlatform>('netease');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [songToAdd, setSongToAdd] = useState<LocalPlaylistSong | null>(null);

  // 执行搜索
  const doSearch = useCallback(async (overridePlatform?: CustomPlatform) => {
    const c = auth.credentials;
    if (!c || c.protocol !== 'custom') return;
    if (!keyword.trim()) return;

    const searchPlatform = overridePlatform ?? platform;

    setLoading(true);
    setError(null);
    setSearched(true);

    // 移动端收起键盘
    if (isMobile && inputRef.current) {
      inputRef.current.blur();
    }

    try {
      const res = await customSearchSongs({
        credentials: c,
        platform: searchPlatform,
        keyword: keyword.trim(),
        page: 1,
        pageSize: 50,
      });
      setResult(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '搜索失败';
      setError(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [auth.credentials, keyword, platform, isMobile]);

  // 按回车搜索
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        void doSearch();
      }
    },
    [doSearch],
  );

  // 切换平台时重新搜索
  const handlePlatformChange = useCallback(
    (val: CustomPlatform) => {
      setPlatform(val);
      if (searched && keyword.trim()) {
        void doSearch(val);
      }
    },
    [doSearch, keyword, searched],
  );

  // 清除搜索
  const handleClear = useCallback(() => {
    setKeyword('');
    setResult(null);
    setSearched(false);
    setError(null);
    inputRef.current?.focus();
  }, []);

  // 构建 Track 对象
  const buildTrack = useCallback(
    (row: CustomSong): Track | null => {
      const c = auth.credentials;
      if (!c || c.protocol !== 'custom') return null;

      const quality = loadAudioQuality(c.protocol);
      const songPlatform = row.platform || platform;

      const buildUrl = async (q: typeof quality): Promise<string> => {
        const syncUrl = buildCustomAudioUrl({
          credentials: c,
          song: row,
          platform: songPlatform,
          quality: q,
        });
        if (syncUrl) return syncUrl;

        const parsed = await customParseSongs({
          credentials: c,
          platform: songPlatform,
          ids: row.id,
          quality: q,
        });

        if (parsed.length === 0) {
          throw new Error('无法获取播放链接');
        }

        const first = parsed[0];
        if (!first.success || !first.url) {
          throw new Error('无法获取播放链接');
        }

        return first.url;
      };

      return {
        id: row.id,
        title: row.name,
        artist: joinArtists(row.artists),
        url: '',
        protocol: c.protocol,
        quality,
        buildUrl,
        platform: songPlatform,
        artists: row.artists,
        coverUrl: row.cover,
      };
    },
    [auth.credentials, platform],
  );

  // 添加到歌单
  const handleAddToPlaylist = useCallback(
    (row: CustomSong) => {
      setSongToAdd({
        id: row.id,
        name: row.name,
        artists: row.artists,
        platform: row.platform || platform,
        addedAt: Date.now(),
      });
      setAddModalOpen(true);
    },
    [platform],
  );

  // 播放全部搜索结果
  const handlePlayAll = useCallback(async () => {
    if (!result || result.songs.length === 0) return;

    const seen = new Set<string>();
    const tracks = result.songs
      .map((s) => {
        const t = buildTrack(s);
        if (!t) return null;
        if (seen.has(t.id)) return null;
        seen.add(t.id);
        return t;
      })
      .filter(Boolean) as Track[];

    await player.playTracks(tracks, 0);
  }, [buildTrack, player, result]);

  // 歌曲项的更多菜单
  const getSongMenu = useCallback((song: CustomSong): MenuProps => ({
    items: [
      { key: 'add', label: '添加到歌单', icon: <PlusOutlined /> },
      { key: 'next', label: '下一首播放' },
    ],
    onClick: ({ key }) => {
      if (key === 'add') {
        handleAddToPlaylist(song);
      } else {
        message.info(`${key}（功能占位）`);
      }
    },
  }), [handleAddToPlaylist]);

  // 非 custom 协议时显示提示
  if (!auth.credentials || auth.credentials.protocol !== 'custom') {
    return (
      <div className={isMobile ? 'mobile-page' : 'linktune-page'}>
        <Alert type="warning" showIcon message="搜索功能仅支持 TuneHub 协议" style={{ borderRadius: 12 }} />
      </div>
    );
  }

  const songs = result?.songs || [];

  // 移动端布局
  if (isMobile) {
    return (
      <div className="mobile-page">
        {/* 页面标题 */}
        <div className="mobile-page__header">
          <h1 className="mobile-page__title">搜索</h1>
        </div>

        {/* 搜索栏 */}
        <div className="mobile-search-bar">
          <SearchOutlined className="mobile-search-bar__icon" />
          <input
            ref={inputRef}
            type="search"
            className="mobile-search-bar__input"
            placeholder="搜索歌曲、歌手..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            enterKeyHint="search"
          />
          {keyword && (
            <button
              type="button"
              className="mobile-search-bar__clear"
              onClick={handleClear}
            >
              <CloseCircleFilled />
            </button>
          )}
        </div>

        {/* 平台选择 */}
        <div className="mobile-platform-selector">
          {PLATFORM_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`mobile-platform-btn ${platform === opt.id ? 'is-active' : ''}`}
              onClick={() => handlePlatformChange(opt.id)}
              style={platform === opt.id ? { background: opt.gradient } : undefined}
            >
              <span>{opt.icon}</span>
              <span>{opt.name}</span>
            </button>
          ))}
        </div>

        {/* 错误提示 */}
        {error && <Alert type="error" showIcon message={error} style={{ borderRadius: 12, marginBottom: 16 }} />}

        {/* 搜索结果 */}
        {loading ? (
          <div className="mobile-loading">
            <div className="mobile-loading__spinner" />
          </div>
        ) : searched && songs.length === 0 && !error ? (
          <div className="mobile-empty">
            <div className="mobile-empty__icon">🔍</div>
            <h3 className="mobile-empty__title">未找到相关歌曲</h3>
            <p className="mobile-empty__desc">
              {platform === 'qq' ? 'QQ 音乐接口可能暂时不可用，请尝试其他平台' : '尝试换个关键词或切换平台'}
            </p>
          </div>
        ) : songs.length > 0 ? (
          <>
            {/* 列表工具栏 */}
            <div className="mobile-list-toolbar">
              <span className="mobile-list-toolbar__info">
                共 {result?.total?.toLocaleString() || songs.length} 首
              </span>
              <div className="mobile-list-toolbar__actions">
                <button
                  type="button"
                  className="mobile-list-toolbar__btn mobile-list-toolbar__btn--primary"
                  onClick={handlePlayAll}
                >
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
            </div>
          </>
        ) : !searched ? (
          <div className="mobile-empty">
            <div className="mobile-empty__icon">🎶</div>
            <h3 className="mobile-empty__title">搜索你喜欢的音乐</h3>
            <p className="mobile-empty__desc">输入歌曲名或歌手名开始搜索</p>
          </div>
        ) : null}

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
    <div className="linktune-page linktune-search">
      {/* 页面头部 */}
      <div className="linktune-page__header">
        <Typography.Title level={2} className="linktune-page__title" style={{ marginBottom: 20 }}>
          搜索
        </Typography.Title>

        {/* 搜索框 */}
        <div className="linktune-searchbar">
          <input
            ref={inputRef}
            type="text"
            className="linktune-searchbar__input"
            placeholder="搜索歌曲、歌手..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            type="primary"
            size="large"
            icon={<SearchOutlined />}
            onClick={() => doSearch()}
            loading={loading}
            className="linktune-searchbar__btn"
          >
            搜索
          </Button>
        </div>

        {/* 平台选择卡片 */}
        <div className="linktune-platforms">
          {PLATFORM_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`linktune-platforms__item ${platform === opt.id ? 'is-active' : ''}`}
              onClick={() => handlePlatformChange(opt.id)}
              style={platform === opt.id ? { background: opt.gradient } : undefined}
            >
              <span className="linktune-platforms__icon">{opt.icon}</span>
              <span className="linktune-platforms__name">{opt.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 搜索结果 */}
      {error && <Alert type="error" showIcon message={error} style={{ borderRadius: 12, marginTop: 16 }} />}

      {loading ? (
        <div className="linktune-loading">
          <Spin size="large" tip="搜索中..." />
        </div>
      ) : searched && songs.length === 0 && !error ? (
        <div className="linktune-empty">
          <div className="linktune-empty__icon">🔍</div>
          <h3 className="linktune-empty__title">未找到相关歌曲</h3>
          <p className="linktune-empty__desc">
            {platform === 'qq' ? 'QQ 音乐接口可能暂时不可用，请尝试其他平台' : '尝试换个关键词或切换平台'}
          </p>
        </div>
      ) : songs.length > 0 ? (
        <>
          <div className="linktune-songlist__toolbar">
            <Typography.Text type="secondary">
              共找到 {result?.total?.toLocaleString() || songs.length} 首歌曲
            </Typography.Text>
            <Button
              type="primary"
              icon={<CaretRightFilled />}
              onClick={handlePlayAll}
              className="linktune-songlist__toolbar-btn"
            >
              播放全部
            </Button>
          </div>

          {/* 桌面端歌曲列表 */}
          <div className="linktune-songlist">
            {songs.map((song) => {
              const isCurrent = player.currentTrack?.id === song.id;
              return (
                <div
                  key={song.id}
                  className={`linktune-song-row ${isCurrent ? 'is-playing' : ''}`}
                  onClick={async () => {
                    const t = buildTrack(song);
                    if (t) await player.playTrack(t);
                  }}
                >
                  {/* 播放按钮 */}
                  <button
                    type="button"
                    className="linktune-song-row__play"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const t = buildTrack(song);
                      if (t) await player.playTrack(t);
                    }}
                  >
                    <PlayCircleOutlined />
                  </button>

                  {/* 封面 */}
                  <div className="linktune-song-row__cover">
                    {song.cover ? (
                      <img src={song.cover} alt={song.name} />
                    ) : (
                      <span className="linktune-song-row__cover-placeholder">🎵</span>
                    )}
                  </div>

                  {/* 信息 */}
                  <div className="linktune-song-row__info">
                    <div className="linktune-song-row__title">{song.name}</div>
                    <div className="linktune-song-row__artist">{joinArtists(song.artists)}</div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="linktune-song-row__actions">
                    <button
                      type="button"
                      className="linktune-song-row__action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToPlaylist(song);
                      }}
                      title="添加到歌单"
                    >
                      <PlusOutlined />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : !searched ? (
        <div className="linktune-empty">
          <div className="linktune-empty__icon">🎶</div>
          <h3 className="linktune-empty__title">搜索你喜欢的音乐</h3>
          <p className="linktune-empty__desc">输入歌曲名或歌手名开始搜索</p>
        </div>
      ) : null}

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
