import { CaretRightFilled, DeleteOutlined, EllipsisOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Dropdown, Modal, Space, Typography, message, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { loadAudioQuality } from '../../config/audioQualityConfig';
import { useIsMobile } from '../../hooks/useIsMobile';
import { usePlayer } from '../../player/PlayerContext';
import type { Track } from '../../player/types';
import { buildCustomAudioUrl, customParseSongs, type CustomPlatform } from '../../protocols/custom/library';
import { useAuth } from '../../session/AuthProvider';
import { SongsTable } from '../library/components/SongsTable';
import type { UnifiedSong } from '../library/types';
import { joinArtists } from '../library/utils/format';
import { AddToPlaylistModal } from '../local-playlists/AddToPlaylistModal';
import type { LocalPlaylistSong } from '../local-playlists/localPlaylistDB';
import { clearPlayHistory, deleteHistoryItem, getPlayHistory, type PlayHistoryItem } from './historyDB';

export function HistoryPage() {
  const { token } = theme.useToken();
  const auth = useAuth();
  const player = usePlayer();
  const isMobile = useIsMobile();

  const [history, setHistory] = useState<PlayHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [tableBodyY, setTableBodyY] = useState<number>(420);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [songToAdd, setSongToAdd] = useState<LocalPlaylistSong | null>(null);

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getPlayHistory(100);
      setHistory(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // 自动调整表格高度（桌面端）
  useEffect(() => {
    if (isMobile) return;
    const el = tableWrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      const bodyY = Math.max(220, Math.floor(h - 60));
      setTableBodyY(bodyY);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  // 构建 Track 对象
  const buildTrack = useCallback(
    (row: PlayHistoryItem): Track | null => {
      const c = auth.credentials;
      if (!c || c.protocol !== 'custom') return null;

      const quality = loadAudioQuality(c.protocol);
      const platform = row.platform as CustomPlatform;

      const buildUrl = async (q: typeof quality): Promise<string> => {
        const syncUrl = buildCustomAudioUrl({
          credentials: c,
          song: { id: row.id, name: row.name, artists: row.artists },
          platform,
          quality: q,
        });
        if (syncUrl) return syncUrl;

        const parsed = await customParseSongs({
          credentials: c,
          platform,
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
        platform,
        artists: row.artists,
        coverUrl: row.coverUrl,
      };
    },
    [auth.credentials],
  );

  // 添加到歌单
  const handleAddToPlaylist = useCallback((row: PlayHistoryItem) => {
    setSongToAdd({
      id: row.id,
      name: row.name,
      artists: row.artists,
      platform: row.platform,
      addedAt: Date.now(),
    });
    setAddModalOpen(true);
  }, []);

  // 删除单条历史
  const handleDelete = useCallback(
    async (row: PlayHistoryItem) => {
      await deleteHistoryItem(row.key);
      message.success('已删除');
      await loadHistory();
    },
    [loadHistory],
  );

  // 清空所有历史
  const handleClearAll = useCallback(() => {
    Modal.confirm({
      title: '清空播放历史',
      content: '确定要清空所有播放历史吗？此操作不可恢复。',
      okText: '清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await clearPlayHistory();
        message.success('已清空播放历史');
        await loadHistory();
      },
    });
  }, [loadHistory]);

  // 播放全部
  const handlePlayAll = useCallback(async () => {
    if (history.length === 0) return;

    const seen = new Set<string>();
    const tracks = history
      .map((item) => {
        const t = buildTrack(item);
        if (!t) return null;
        if (seen.has(t.id)) return null;
        seen.add(t.id);
        return t;
      })
      .filter(Boolean) as Track[];

    await player.playTracks(tracks, 0);
  }, [buildTrack, history, player]);

  // 转换为 UnifiedSong 格式
  const songs: UnifiedSong[] = useMemo(() => {
    return history.map((item) => ({
      id: item.id,
      name: item.name,
      artists: item.artists,
      platform: item.platform,
      cover: item.coverUrl,
    }));
  }, [history]);

  // 格式化时间
  const formatPlayedAt = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return new Date(timestamp).toLocaleDateString();
  };

  // 歌曲项的更多菜单
  const getSongMenu = useCallback((item: PlayHistoryItem): MenuProps => ({
    items: [
      { key: 'add', label: '添加到歌单', icon: <PlusOutlined /> },
      { key: 'delete', label: '删除记录', icon: <DeleteOutlined />, danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'add') {
        handleAddToPlaylist(item);
      } else if (key === 'delete') {
        void handleDelete(item);
      }
    },
  }), [handleAddToPlaylist, handleDelete]);

  // 表格列定义（桌面端）
  const columns: ColumnsType<UnifiedSong> = useMemo(() => {
    return [
      {
        title: '歌曲',
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        render: (_: unknown, row, index) => {
          const isCurrent = player.currentTrack?.id === row.id;
          const artist = joinArtists(row.artists);
          const historyItem = history[index];

          return (
            <Space size={10} style={{ minWidth: 0 }}>
              <Button
                type={isCurrent ? 'primary' : 'text'}
                icon={<PlayCircleOutlined />}
                onClick={async () => {
                  const t = buildTrack(historyItem);
                  if (!t) return;
                  await player.playTrack(t);
                }}
              />
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={() => handleAddToPlaylist(historyItem)}
                title="添加到歌单"
              />

              <div style={{ minWidth: 0, flex: 1 }}>
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
        title: '播放时间',
        dataIndex: 'playedAt',
        key: 'playedAt',
        width: 120,
        render: (_: unknown, _row, index) => {
          const historyItem = history[index];
          return (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatPlayedAt(historyItem.playedAt)}
            </Typography.Text>
          );
        },
      },
      {
        title: '播放次数',
        dataIndex: 'playCount',
        key: 'playCount',
        width: 80,
        render: (_: unknown, _row, index) => {
          const historyItem = history[index];
          return (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {historyItem.playCount} 次
            </Typography.Text>
          );
        },
      },
      {
        title: '',
        key: 'actions',
        width: 50,
        render: (_: unknown, _row, index) => {
          const historyItem = history[index];
          return (
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(historyItem)}
              title="删除记录"
            />
          );
        },
      },
    ];
  }, [buildTrack, handleAddToPlaylist, handleDelete, history, player, token.colorText, token.colorTextSecondary]);

  // 非 custom 协议时显示提示
  if (!auth.credentials || auth.credentials.protocol !== 'custom') {
    return (
      <div className={isMobile ? 'mobile-page' : 'linktune-page'}>
        <Alert type="warning" showIcon message="播放历史功能仅支持 TuneHub 协议" style={{ borderRadius: 12 }} />
      </div>
    );
  }

  // 移动端布局
  if (isMobile) {
    return (
      <div className="mobile-page">
        {/* 页面标题 */}
        <div className="mobile-page__header">
          <h1 className="mobile-page__title">播放历史</h1>
          <p className="mobile-page__subtitle">共 {history.length} 首歌曲</p>
        </div>

        {/* 列表工具栏 */}
        {history.length > 0 && (
          <div className="mobile-list-toolbar">
            <div className="mobile-list-toolbar__actions" style={{ width: '100%', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="mobile-list-toolbar__btn mobile-list-toolbar__btn--secondary"
                onClick={handleClearAll}
              >
                <DeleteOutlined /> 清空
              </button>
              <button
                type="button"
                className="mobile-list-toolbar__btn mobile-list-toolbar__btn--primary"
                onClick={handlePlayAll}
              >
                <CaretRightFilled /> 播放全部
              </button>
            </div>
          </div>
        )}

        {/* 历史列表 */}
        {loading ? (
          <div className="mobile-loading">
            <div className="mobile-loading__spinner" />
          </div>
        ) : history.length === 0 ? (
          <div className="mobile-empty">
            <div className="mobile-empty__icon">📝</div>
            <h3 className="mobile-empty__title">暂无播放历史</h3>
            <p className="mobile-empty__desc">播放的歌曲会自动记录在这里</p>
          </div>
        ) : (
          <div className="mobile-song-list">
            {history.map((item) => {
              const isCurrent = player.currentTrack?.id === item.id;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`mobile-song-item ${isCurrent ? 'is-playing' : ''}`}
                  onClick={async () => {
                    const t = buildTrack(item);
                    if (t) await player.playTrack(t);
                  }}
                >
                  {/* 播放动画 / 封面 */}
                  {isCurrent ? (
                    <div className="mobile-song-item__playing-indicator">
                      <span /><span /><span />
                    </div>
                  ) : (
                    <div className="mobile-song-item__cover">
                      {item.coverUrl ? (
                        <img src={item.coverUrl} alt={item.name} />
                      ) : (
                        <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>🎵</span>
                      )}
                    </div>
                  )}

                  {/* 信息 */}
                  <div className="mobile-song-item__info">
                    <p className="mobile-song-item__title">{item.name}</p>
                    <div className="mobile-song-item__meta">
                      <p className="mobile-song-item__artist">
                        {joinArtists(item.artists)} · {formatPlayedAt(item.playedAt)}
                      </p>
                    </div>
                  </div>

                  {/* 更多按钮 */}
                  <Dropdown menu={getSongMenu(item)} trigger={['click']} placement="bottomRight">
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
    <div className="linktune-page linktune-history">
      {/* 头部 */}
      <div className="linktune-page__header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Typography.Title level={2} className="linktune-page__title" style={{ marginBottom: 4 }}>
              播放历史
            </Typography.Title>
            <Typography.Text type="secondary">
              共 {history.length} 首歌曲
            </Typography.Text>
          </div>

          <Space wrap>
            <Button onClick={handleClearAll} disabled={history.length === 0} style={{ borderRadius: 10 }}>
              清空历史
            </Button>
            <Button type="primary" icon={<CaretRightFilled />} onClick={handlePlayAll} disabled={history.length === 0} style={{ borderRadius: 10 }}>
              播放全部
            </Button>
          </Space>
        </div>
      </div>

      {/* 历史列表 */}
      {history.length === 0 && !loading ? (
        <div className="linktune-empty">
          <div className="linktune-empty__icon">📝</div>
          <h3 className="linktune-empty__title">暂无播放历史</h3>
          <p className="linktune-empty__desc">播放的歌曲会自动记录在这里</p>
        </div>
      ) : (
        <SongsTable
          tableWrapRef={tableWrapRef}
          songs={songs}
          columns={columns}
          loading={loading}
          tableBodyY={tableBodyY}
          rowKey={(row) => `${row.platform}:${row.id}`}
          onRowDoubleClick={async (row) => {
            const index = songs.findIndex((s) => s.id === row.id && s.platform === row.platform);
            if (index >= 0) {
              const t = buildTrack(history[index]);
              if (!t) return;
              await player.playTrack(t);
            }
          }}
        />
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
