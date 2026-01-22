import { DeleteOutlined, EditOutlined, FolderAddOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Input, Modal, Popconfirm, Space, Typography, message, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  createLocalPlaylist,
  deleteLocalPlaylist,
  getLocalPlaylists,
  migrateFromLocalStorage,
  renameLocalPlaylist,
  type LocalPlaylist,
} from './localPlaylistDB';

export function LocalPlaylistsPage() {
  const { token } = theme.useToken();
  const navigate = useNavigate();

  const [playlists, setPlaylists] = useState<LocalPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const refresh = useCallback(async () => {
    const list = await getLocalPlaylists();
    setPlaylists(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    // 首次加载时尝试迁移 localStorage 数据
    migrateFromLocalStorage().then((count) => {
      if (count > 0) {
        message.success(`已从旧存储迁移 ${count} 个歌单`);
      }
      void refresh();
    });
  }, [refresh]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ marginBottom: 0 }}>
          我的歌单
        </Typography.Title>
        <Button type="primary" icon={<FolderAddOutlined />} onClick={() => setCreateModalOpen(true)}>
          新建歌单
        </Button>
      </div>

      {playlists.length === 0 ? (
        <Empty description="暂无歌单，点击右上角新建一个吧" style={{ marginTop: 60 }} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {playlists.map((p) => (
            <Card
              key={p.id}
              hoverable
              style={{ borderColor: token.colorBorder }}
              styles={{ body: { padding: 16 } }}
              onClick={() => navigate(`/local-playlists/${p.id}`, { state: { playlistName: p.name } })}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {editingId === p.id ? (
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onPressEnter={() => void handleSaveEdit()}
                    onBlur={() => void handleSaveEdit()}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <Typography.Text strong ellipsis style={{ fontSize: 16 }}>
                    {p.name}
                  </Typography.Text>
                )}

                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {p.songs.length} 首歌曲
                </Typography.Text>

                <Space size={4} style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/local-playlists/${p.id}`, { state: { playlistName: p.name, autoPlay: true } });
                    }}
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
      >
        <Input
          placeholder="请输入歌单名称"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          onPressEnter={() => void handleCreate()}
          autoFocus
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  );
}
