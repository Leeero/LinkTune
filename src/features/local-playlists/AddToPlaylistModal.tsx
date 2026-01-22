import { FolderAddOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Input, List, Modal, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import {
  addSongToPlaylist,
  createLocalPlaylist,
  getLocalPlaylists,
  type LocalPlaylist,
  type LocalPlaylistSong,
} from './localPlaylistDB';

type Props = {
  open: boolean;
  onClose: () => void;
  song: LocalPlaylistSong | null;
};

export function AddToPlaylistModal({ open, onClose, song }: Props) {
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const refresh = useCallback(async () => {
    const list = await getLocalPlaylists();
    setPlaylists(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setCreating(false);
      setNewName('');
      void refresh();
    }
  }, [open, refresh]);

  const handleAddToPlaylist = async (playlist: LocalPlaylist) => {
    if (!song) return;
    const success = await addSongToPlaylist(playlist.id, song);
    if (success) {
      message.success(`已添加到「${playlist.name}」`);
    } else {
      message.warning('歌曲已在该歌单中');
    }
    onClose();
  };

  const handleCreateAndAdd = async () => {
    const name = newName.trim();
    if (!name) {
      message.warning('请输入歌单名称');
      return;
    }
    const newPlaylist = await createLocalPlaylist(name);
    if (song) {
      await addSongToPlaylist(newPlaylist.id, song);
      message.success(`已创建「${name}」并添加歌曲`);
    } else {
      message.success(`已创建「${name}」`);
    }
    onClose();
  };

  return (
    <Modal
      title="添加到歌单"
      open={open}
      onCancel={onClose}
      footer={null}
      width={400}
    >
      {creating ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input
            placeholder="新歌单名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onPressEnter={() => void handleCreateAndAdd()}
            autoFocus
          />
          <Button type="primary" onClick={() => void handleCreateAndAdd()}>
            创建
          </Button>
          <Button onClick={() => setCreating(false)}>取消</Button>
        </div>
      ) : (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => setCreating(true)}
          style={{ width: '100%', marginBottom: 16 }}
        >
          新建歌单
        </Button>
      )}

      {loading ? null : playlists.length === 0 ? (
        <Empty description="暂无歌单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={playlists}
          renderItem={(p) => (
            <List.Item
              style={{ cursor: 'pointer', padding: '10px 12px', borderRadius: 6 }}
              onClick={() => void handleAddToPlaylist(p)}
            >
              <List.Item.Meta
                avatar={<FolderAddOutlined style={{ fontSize: 20 }} />}
                title={p.name}
                description={`${p.songs.length} 首歌曲`}
              />
            </List.Item>
          )}
          style={{ maxHeight: 300, overflowY: 'auto' }}
        />
      )}
    </Modal>
  );
}
