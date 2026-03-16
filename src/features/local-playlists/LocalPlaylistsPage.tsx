import { DeleteOutlined, EditOutlined, FolderAddOutlined, PlayCircleOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Input, Modal, Popconfirm, Space, Typography, message, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useIsMobile } from '../../hooks/useIsMobile';
import { usePlaylistsStore } from '../../stores/playlistsStore';

import {
  createLocalPlaylist,
  deleteLocalPlaylist,
  migrateFromLocalStorage,
  renameLocalPlaylist,
  type LocalPlaylist,
} from './localPlaylistDB';

export function LocalPlaylistsPage() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // 从 store 读取缓存数据
  const playlists = usePlaylistsStore((s) => s.localPlaylists);
  const loading = usePlaylistsStore((s) => s.localLoading);
  const initialized = usePlaylistsStore((s) => s.localInitialized);
  const fetchLocalPlaylists = usePlaylistsStore((s) => s.fetchLocalPlaylists);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // refresh 重新拉取并更新 store
  const refresh = useCallback(async () => {
    await fetchLocalPlaylists();
  }, [fetchLocalPlaylists]);

  useEffect(() => {
    if (!initialized) {
      // 首次加载时尝试迁移 localStorage 数据
      migrateFromLocalStorage().then((count) => {
        if (count > 0) {
          message.success(`已从旧存储迁移 ${count} 个歌单`);
        }
        void refresh();
      });
    }
  }, [initialized, refresh]);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) {
      message.warning('请输入歌单名称');
      return;
    }
    const newPlaylist = await createLocalPlaylist(name);
    setCreateModalOpen(false);
    setCreateName('');
    await refresh();
    message.success(`歌单「${newPlaylist.name}」创建成功`);
  };

  const handleDelete = async (playlist: LocalPlaylist) => {
    await deleteLocalPlaylist(playlist.id);
    await refresh();
    message.success(`已删除「${playlist.name}」`);
  };

  const handleStartEdit = (playlist: LocalPlaylist) => {
    setEditingId(playlist.id);
    setEditingName(playlist.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) {
      message.warning('歌单名称不能为空');
      return;
    }
    await renameLocalPlaylist(editingId, name);
    setEditingId(null);
    setEditingName('');
    await refresh();
    message.success('已重命名');
  };

  if (loading) {
    return null;
  }

  // 移动端布局
  if (isMobile) {
    return (
      <div className="mobile-page">
        {/* 页面标题 */}
        <div className="mobile-page__header">
          <h1 className="mobile-page__title">我的歌单</h1>
          <p className="mobile-page__subtitle">
            {playlists.length > 0 ? `共 ${playlists.length} 个歌单` : '创建你的第一个歌单'}
          </p>
        </div>

        {/* 新建歌单按钮 */}
        <button
          type="button"
          className="mobile-list-toolbar__btn mobile-list-toolbar__btn--primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', marginBottom: 16, borderRadius: 12 }}
          onClick={() => setCreateModalOpen(true)}
        >
          <FolderAddOutlined /> 新建歌单
        </button>

        {/* 歌单列表 */}
        {playlists.length === 0 ? (
          <div className="mobile-empty">
            <div className="mobile-empty__icon">🎵</div>
            <h3 className="mobile-empty__title">暂无歌单</h3>
            <p className="mobile-empty__desc">点击上方按钮创建一个吧</p>
          </div>
        ) : (
          <div className="mobile-playlist-list">
            {playlists.map((p) => (
              <button
                key={p.id}
                type="button"
                className="mobile-playlist-item"
                onClick={() => navigate(`/local-playlists/${p.id}`, { state: { playlistName: p.name } })}
              >
                <div className="mobile-playlist-item__cover">🎵</div>

                <div className="mobile-playlist-item__info">
                  {editingId === p.id ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onPressEnter={() => void handleSaveEdit()}
                      onBlur={() => void handleSaveEdit()}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{ borderRadius: 8 }}
                    />
                  ) : (
                    <>
                      <h4 className="mobile-playlist-item__title">{p.name}</h4>
                      <p className="mobile-playlist-item__desc">{p.songs.length} 首歌曲</p>
                    </>
                  )}
                </div>

                <div className="mobile-playlist-item__actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="mobile-playlist-item__action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/local-playlists/${p.id}`, { state: { playlistName: p.name, autoPlay: true } });
                    }}
                  >
                    <PlayCircleOutlined />
                  </button>
                  <button
                    type="button"
                    className="mobile-playlist-item__action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(p);
                    }}
                  >
                    <EditOutlined />
                  </button>
                </div>

                <RightOutlined style={{ color: 'var(--lt-text-secondary)', fontSize: 12 }} />
              </button>
            ))}
          </div>
        )}

        <Modal
          title="新建歌单"
          open={createModalOpen}
          onOk={() => void handleCreate()}
          onCancel={() => { setCreateModalOpen(false); setCreateName(''); }}
          okText="创建"
          cancelText="取消"
          styles={{ body: { paddingTop: 20 } }}
        >
          <Input
            placeholder="请输入歌单名称"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onPressEnter={() => void handleCreate()}
            autoFocus
            size="large"
            style={{ borderRadius: 10 }}
          />
        </Modal>
      </div>
    );
  }

  // 桌面端布局
  return (
    <div className="linktune-page linktune-playlists">
      {/* 页面头部 */}
      <div className="linktune-page__header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Typography.Title level={2} className="linktune-page__title" style={{ marginBottom: 4 }}>
              我的歌单
            </Typography.Title>
            <Typography.Text type="secondary">
              {playlists.length > 0 ? `共 ${playlists.length} 个歌单` : '创建你的第一个歌单'}
            </Typography.Text>
          </div>
          <Button
            type="primary"
            icon={<FolderAddOutlined />}
            onClick={() => setCreateModalOpen(true)}
            style={{ borderRadius: 10 }}
          >
            新建歌单
          </Button>
        </div>
      </div>

      {playlists.length === 0 ? (
        <div className="linktune-page__empty">
          <Empty
            description={
              <span>
                暂无歌单
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  点击右上角「新建歌单」创建一个吧
                </Typography.Text>
              </span>
            }
          />
        </div>
      ) : (
        <div className="linktune-playlists__grid">
          {playlists.map((p) => (
            <Card
              key={p.id}
              hoverable
              className="linktune-playlists__card"
              style={{ borderColor: token.colorBorder }}
              styles={{ body: { padding: 0 } }}
              onClick={() => navigate(`/local-playlists/${p.id}`, { state: { playlistName: p.name } })}
            >
              {/* 封面区域 */}
              <div className="linktune-playlists__cardCover">
                🎵
              </div>

              {/* 信息区域 */}
              <div style={{ padding: 16 }}>
                {editingId === p.id ? (
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onPressEnter={() => void handleSaveEdit()}
                    onBlur={() => void handleSaveEdit()}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    style={{ borderRadius: 8 }}
                  />
                ) : (
                  <Typography.Text strong ellipsis style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>
                    {p.name}
                  </Typography.Text>
                )}

                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {p.songs.length} 首歌曲
                </Typography.Text>

                <Space size={4} style={{ marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/local-playlists/${p.id}`, { state: { playlistName: p.name, autoPlay: true } });
                    }}
                    style={{ borderRadius: 8 }}
                  >
                    播放
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(p);
                    }}
                    style={{ borderRadius: 8 }}
                  />
                  <Popconfirm
                    title="确定删除这个歌单吗？"
                    onConfirm={() => void handleDelete(p)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                      style={{ borderRadius: 8 }}
                    />
                  </Popconfirm>
                </Space>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title="新建歌单"
        open={createModalOpen}
        onOk={() => void handleCreate()}
        onCancel={() => {
          setCreateModalOpen(false);
          setCreateName('');
        }}
        okText="创建"
        cancelText="取消"
        styles={{
          body: { paddingTop: 20 },
        }}
      >
        <Input
          placeholder="请输入歌单名称"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          onPressEnter={() => void handleCreate()}
          autoFocus
          size="large"
          style={{ borderRadius: 10 }}
        />
      </Modal>
    </div>
  );
}
