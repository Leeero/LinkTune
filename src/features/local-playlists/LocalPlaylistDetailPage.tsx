import {
  ArrowLeftOutlined,
  ClearOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { Alert, Button, Checkbox, Dropdown, Input, Modal, Popconfirm, Space, Tag, Typography, message, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { CUSTOM_PLAYLISTS } from '../../app/shell/customPlaylists';
import { loadAudioQuality } from '../../config/audioQualityConfig';
import { usePlayer } from '../../player/PlayerContext';
import type { Track } from '../../player/types';
import { buildCustomAudioUrl, customParseSongs } from '../../protocols/custom/library';
import { useAuth } from '../../session/AuthProvider';
import { SongsTable } from '../library/components/SongsTable';
import { joinArtists } from '../library/utils/format';
import {
  clearPlaylistSongs,
  duplicateLocalPlaylist,
  getLocalPlaylist,
  removeSongFromPlaylist,
  removeSongsFromPlaylist,
  renameLocalPlaylist,
  reorderPlaylistSongs,
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

function getSongKey(song: LocalPlaylistSong): string {
  const platform = song.platform || song.source || 'netease';
  return `${platform}:${song.id}`;
}

// 可拖拽的行组件
function DraggableRow({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { 'data-row-key'?: string }) {
  const rowKey = props['data-row-key'];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rowKey || '',
  });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'move',
    ...(isDragging ? { background: 'rgba(0,0,0,0.05)', zIndex: 1 } : {}),
  };

  return (
    <tr {...props} ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </tr>
  );
}

export function LocalPlaylistDetailPage() {
  const { token } = theme.useToken();
  const auth = useAuth();
  const player = usePlayer();
  const navigate = useNavigate();

  const location = useLocation();
  const { playlistId } = useParams();

  const state = isRecord(location.state) ? location.state : null;
  const passedName = typeof state?.playlistName === 'string' ? state.playlistName : '';
  const autoPlay = state?.autoPlay === true;

  const [playlist, setPlaylist] = useState<LocalPlaylist | null>(null);
  const [loading, setLoading] = useState(true);

  // 编辑模式
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');

  // 批量选择
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // 复制歌单弹窗
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');

  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [tableBodyY, setTableBodyY] = useState<number>(420);

  const autoPlayTriggeredRef = useRef(false);

  // 拖拽排序 sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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

  // 返回歌单列表
  const handleGoBack = useCallback(() => {
    navigate('/local-playlists');
  }, [navigate]);

  // 开始编辑名称
  const handleStartEditName = useCallback(() => {
    if (!playlist) return;
    setEditingName(playlist.name);
    setIsEditing(true);
  }, [playlist]);

  // 保存名称
  const handleSaveName = useCallback(async () => {
    if (!playlistId || !editingName.trim()) {
      setIsEditing(false);
      return;
    }
    await renameLocalPlaylist(playlistId, editingName.trim());
    await refresh();
    setIsEditing(false);
    message.success('歌单已重命名');
  }, [editingName, playlistId, refresh]);

  // 清空歌单
  const handleClearPlaylist = useCallback(async () => {
    if (!playlistId) return;
    await clearPlaylistSongs(playlistId);
    await refresh();
    setSelectedKeys(new Set());
    message.success('歌单已清空');
  }, [playlistId, refresh]);

  // 复制歌单
  const handleDuplicatePlaylist = useCallback(async () => {
    if (!playlistId) return;
    const newPlaylist = await duplicateLocalPlaylist(playlistId, duplicateName.trim() || undefined);
    if (newPlaylist) {
      message.success(`已创建副本「${newPlaylist.name}」`);
      setDuplicateModalOpen(false);
      setDuplicateName('');
      // 可选：跳转到新歌单
      navigate(`/local-playlists/${newPlaylist.id}`, { state: { playlistName: newPlaylist.name } });
    }
  }, [duplicateName, navigate, playlistId]);

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    if (!playlistId || selectedKeys.size === 0) return;
    const keys = Array.from(selectedKeys).map((k) => {
      const [platform, id] = k.split(':');
      return { id, platform };
    });
    const count = await removeSongsFromPlaylist(playlistId, keys);
    await refresh();
    setSelectedKeys(new Set());
    setIsSelectMode(false);
    message.success(`已删除 ${count} 首歌曲`);
  }, [playlistId, refresh, selectedKeys]);

  // 拖拽结束
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !playlist || !playlistId) return;

      const oldIndex = playlist.songs.findIndex((s) => getSongKey(s) === active.id);
      const newIndex = playlist.songs.findIndex((s) => getSongKey(s) === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(playlist.songs, oldIndex, newIndex);
      setPlaylist({ ...playlist, songs: newOrder });
      await reorderPlaylistSongs(playlistId, newOrder);
    },
    [playlist, playlistId],
  );

  const buildTrack = useCallback(
    (song: LocalPlaylistSong): Track | null => {
      const c = auth.credentials;
      if (!c || c.protocol !== 'custom') return null;

      const quality = loadAudioQuality(c.protocol);
      const platform = (song.platform || song.source || 'netease') as 'netease' | 'qq' | 'kuwo';

      // buildUrl 需要异步调用解析接口
      const buildUrl = async (q: typeof quality): Promise<string> => {
        const syncUrl = buildCustomAudioUrl({
          credentials: c,
          song: { id: song.id, name: song.name, artists: song.artists || [] },
          platform,
          quality: q,
        });
        if (syncUrl) return syncUrl;

        // 否则调用解析接口
        const parsed = await customParseSongs({
          credentials: c,
          platform,
          ids: song.id,
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
        id: `${platform}:${song.id}`,
        title: song.name,
        artist: joinArtists(song.artists || []),
        artists: song.artists || [],
        url: '', // 需要异步获取
        protocol: c.protocol,
        quality,
        buildUrl,
        platform,
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
      const platform = song.platform || song.source || 'netease';
      await removeSongFromPlaylist(playlistId, song.id, platform);
      await refresh();
      message.success('已从歌单移除');
    },
    [playlistId, refresh],
  );

  // 切换选择
  const toggleSelect = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (!playlist) return;
    if (selectedKeys.size === playlist.songs.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(playlist.songs.map(getSongKey)));
    }
  }, [playlist, selectedKeys.size]);

  // 更多操作菜单
  const moreMenuItems: MenuProps['items'] = useMemo(
    () => [
      {
        key: 'rename',
        icon: <EditOutlined />,
        label: '重命名',
        onClick: handleStartEditName,
      },
      {
        key: 'duplicate',
        icon: <CopyOutlined />,
        label: '复制歌单',
        onClick: () => {
          setDuplicateName(playlist ? `${playlist.name} (副本)` : '');
          setDuplicateModalOpen(true);
        },
      },
      { type: 'divider' },
      {
        key: 'selectMode',
        icon: <DeleteOutlined />,
        label: isSelectMode ? '退出批量管理' : '批量管理',
        onClick: () => {
          setIsSelectMode(!isSelectMode);
          setSelectedKeys(new Set());
        },
      },
      { type: 'divider' },
      {
        key: 'clear',
        icon: <ClearOutlined />,
        label: '清空歌单',
        danger: true,
        onClick: () => {
          Modal.confirm({
            title: '确定清空歌单吗？',
            content: '此操作将移除歌单中的所有歌曲，不可恢复。',
            okText: '清空',
            okButtonProps: { danger: true },
            cancelText: '取消',
            onOk: handleClearPlaylist,
          });
        },
      },
    ],
    [handleClearPlaylist, handleStartEditName, isSelectMode, playlist],
  );

  const columns: ColumnsType<LocalPlaylistSong> = useMemo(() => {
    const cols: ColumnsType<LocalPlaylistSong> = [];

    // 选择模式下显示复选框
    if (isSelectMode) {
      cols.push({
        title: (
          <Checkbox
            checked={playlist ? selectedKeys.size === playlist.songs.length && playlist.songs.length > 0 : false}
            indeterminate={selectedKeys.size > 0 && playlist ? selectedKeys.size < playlist.songs.length : false}
            onChange={toggleSelectAll}
          />
        ),
        key: 'select',
        width: 50,
        render: (_: unknown, row) => {
          const key = getSongKey(row);
          return <Checkbox checked={selectedKeys.has(key)} onChange={() => toggleSelect(key)} />;
        },
      });
    } else {
      // 非选择模式显示拖拽手柄
      cols.push({
        title: '',
        key: 'drag',
        width: 40,
        render: () => <HolderOutlined style={{ cursor: 'move', color: token.colorTextTertiary }} />,
      });
    }

    cols.push(
      {
        title: '歌曲',
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        render: (_: unknown, row) => {
          const platform = row.platform || row.source || 'netease';
          const trackId = `${platform}:${row.id}`;
          const isCurrent = player.currentTrack?.id === trackId;
          const artist = joinArtists(row.artists || []);

          return (
            <Space size={10} style={{ minWidth: 0 }}>
              <Button
                type={isCurrent ? 'primary' : 'text'}
                icon={<PlayCircleOutlined />}
                onClick={async (e) => {
                  e.stopPropagation();
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
        dataIndex: 'platform',
        key: 'platform',
        width: 100,
        render: (_: unknown, row) => {
          const platform = row.platform || row.source || 'netease';
          return <Tag>{labelForSource(platform)}</Tag>;
        },
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
            <Button type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
          </Popconfirm>
        ),
      },
    );

    return cols;
  }, [
    buildTrack,
    handleRemoveSong,
    isSelectMode,
    player,
    playlist,
    selectedKeys,
    toggleSelect,
    toggleSelectAll,
    token.colorText,
    token.colorTextSecondary,
    token.colorTextTertiary,
  ]);

  const sortableIds = useMemo(() => {
    return playlist?.songs.map(getSongKey) || [];
  }, [playlist?.songs]);

  if (loading) {
    return null;
  }

  if (!playlist) {
    return <Alert type="warning" showIcon message="歌单不存在或已被删除" />;
  }

  const pageTitle = passedName || playlist.name;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      {/* 顶部操作栏 */}
      <div
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'nowrap' }}
      >
        <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleGoBack} title="返回歌单列表" />

          <div style={{ minWidth: 0, flex: 1 }}>
            {isEditing ? (
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onPressEnter={() => void handleSaveName()}
                onBlur={() => void handleSaveName()}
                autoFocus
                style={{ maxWidth: 300, fontSize: 18, fontWeight: 600 }}
              />
            ) : (
              <Typography.Title
                level={3}
                ellipsis={{ tooltip: pageTitle }}
                style={{ marginBottom: 0, cursor: 'pointer' }}
                onClick={handleStartEditName}
              >
                {pageTitle}
                <EditOutlined style={{ marginLeft: 8, fontSize: 14, color: token.colorTextTertiary }} />
              </Typography.Title>
            )}
            <Space size={8} wrap style={{ marginTop: 6 }}>
              <Tag color="green">本地歌单</Tag>
              <Typography.Text type="secondary">{playlist.songs.length} 首歌曲</Typography.Text>
            </Space>
          </div>
        </div>

        <Space>
          {isSelectMode && selectedKeys.size > 0 && (
            <Popconfirm
              title={`确定删除选中的 ${selectedKeys.size} 首歌曲吗？`}
              onConfirm={() => void handleBatchDelete()}
              okText="删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
            >
              <Button danger>删除选中 ({selectedKeys.size})</Button>
            </Popconfirm>
          )}
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
            <Button>更多操作</Button>
          </Dropdown>
          <Button type="primary" onClick={handlePlayAll} disabled={playlist.songs.length === 0}>
            播放全部
          </Button>
        </Space>
      </div>

      {/* 歌曲列表 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <SongsTable
            tableWrapRef={tableWrapRef}
            songs={playlist.songs}
            columns={columns}
            loading={false}
            tableBodyY={tableBodyY}
            rowKey={getSongKey}
            components={
              !isSelectMode
                ? {
                    body: {
                      row: DraggableRow,
                    },
                  }
                : undefined
            }
            onRowDoubleClick={async (row) => {
              const t = buildTrack(row as LocalPlaylistSong);
              if (!t) return;
              await player.playTrack(t);
            }}
          />
        </SortableContext>
      </DndContext>

      {/* 复制歌单弹窗 */}
      <Modal
        title="复制歌单"
        open={duplicateModalOpen}
        onOk={() => void handleDuplicatePlaylist()}
        onCancel={() => {
          setDuplicateModalOpen(false);
          setDuplicateName('');
        }}
        okText="复制"
        cancelText="取消"
      >
        <Input
          placeholder="请输入新歌单名称"
          value={duplicateName}
          onChange={(e) => setDuplicateName(e.target.value)}
          onPressEnter={() => void handleDuplicatePlaylist()}
          autoFocus
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  );
}
