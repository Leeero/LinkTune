import {
  CustomerServiceOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { Link } from 'react-router-dom';

import type { EmbyPlaylist } from '../../protocols/emby/types';
import { CUSTOM_PLAYLISTS } from './customPlaylists';

type MenuItem = NonNullable<MenuProps['items']>[number];

export function buildShellMenuItems(params: {
  isCustom: boolean;
  isEmby: boolean;
  playlists: EmbyPlaylist[];
  playlistsLoading: boolean;
  playlistsError: string | null;
}): MenuItem[] {
  const { isCustom, isEmby, playlists, playlistsLoading, playlistsError } = params;

  // 自定义协议：固定歌单列表
  if (isCustom) {
    const customPlaylistChildren: MenuItem[] = CUSTOM_PLAYLISTS.map((p) => {
      const to = `/playlists/${p.id}`;
      return {
        key: to,
        label: (
          <Link to={to} state={{ playlistName: p.name, source: p.id }}>
            {p.name}
          </Link>
        ),
      };
    });

    return [
      {
        key: '/playlists',
        icon: <UnorderedListOutlined />,
        label: '歌单',
        children: customPlaylistChildren,
      },
      {
        key: '/settings',
        icon: <SettingOutlined />,
        label: <Link to="/settings">设置</Link>,
      },
    ];
  }

  // Emby / Navidrome 协议
  const playlistChildren: MenuItem[] = (() => {
    if (!isEmby) return [{ key: '/playlists/__disabled', disabled: true, label: '仅支持 Emby' }];
    if (playlistsLoading) return [{ key: '/playlists/__loading', disabled: true, label: '歌单加载中…' }];
    if (playlistsError) return [{ key: '/playlists/__error', disabled: true, label: `加载失败：${playlistsError}` }];
    if (playlists.length === 0) return [{ key: '/playlists/__empty', disabled: true, label: '暂无歌单' }];

    return playlists.map((p) => {
      const to = `/playlists/${p.id}`;
      return {
        key: to,
        label: (
          <Tooltip title={p.name} placement="right" mouseEnterDelay={0.2} destroyTooltipOnHide>
            <Link
              to={to}
              state={{ playlistName: p.name }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }}
            >
              <span title={p.name} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
              {typeof p.songCount === 'number' ? (
                <span style={{ opacity: 0.65, fontSize: 12, flex: '0 0 auto' }}>{p.songCount}</span>
              ) : null}
            </Link>
          </Tooltip>
        ),
      };
    });
  })();

  return [
    {
      key: '/library',
      icon: <CustomerServiceOutlined />,
      label: <Link to="/library">音乐库</Link>,
    },
    {
      key: '/playlists',
      icon: <UnorderedListOutlined />,
      label: '歌单',
      children: playlistChildren,
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: <Link to="/settings">设置</Link>,
    },
  ];
}
