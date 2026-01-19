import {
  CustomerServiceOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Layout, Menu, Tooltip, Typography, theme } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { HashRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import logoImg from '../assets/logo.png';
import { LibraryPage } from '../features/library/LibraryPage';
import { LoginPage } from '../features/login/LoginPage';
import { NowPlayingPage } from '../features/now-playing/NowPlayingPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { PlayerProvider } from '../player/PlayerContext';
import { PlayerBar } from '../player/components/PlayerBar';
import { embyGetPlaylists } from '../protocols/emby/library';
import type { EmbyPlaylist } from '../protocols/emby/types';
import { useAuth } from '../session/AuthProvider';
import { useThemeMode } from '../theme/ThemeProvider';

const { Sider, Content } = Layout;

function Shell() {
  const location = useLocation();
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const auth = useAuth();

  const isDark = mode === 'dark';
  const isEmby = auth.credentials?.protocol === 'emby';

  const [playlists, setPlaylists] = useState<EmbyPlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.credentials || auth.credentials.protocol !== 'emby') {
      setPlaylists([]);
      setPlaylistsLoading(false);
      setPlaylistsError(null);
      return;
    }

    const controller = new AbortController();
    setPlaylistsLoading(true);
    setPlaylistsError(null);

    embyGetPlaylists({ credentials: auth.credentials, signal: controller.signal })
      .then((list) => {
        if (controller.signal.aborted) return;
        setPlaylists(list);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setPlaylists([]);
        setPlaylistsError(e instanceof Error ? e.message : '加载歌单失败');
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setPlaylistsLoading(false);
      });

    return () => controller.abort();
  }, [auth.credentials]);

  const [openKeys, setOpenKeys] = useState<string[]>(() => (location.pathname.startsWith('/playlists/') ? ['/playlists'] : []));
  useEffect(() => {
    if (location.pathname.startsWith('/playlists/')) {
      setOpenKeys((prev) => (prev.includes('/playlists') ? prev : [...prev, '/playlists']));
    }
  }, [location.pathname]);

  const menuItems = useMemo(() => {
    const playlistChildren = (() => {
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
                <span
                  title={p.name}
                  style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
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
  }, [isEmby, playlists, playlistsError, playlistsLoading]);


  return (
    <Layout
      className="linktune-app"
      data-theme={isDark ? 'dark' : 'light'}
      style={{ background: token.colorBgLayout, height: '100vh', overflow: 'hidden' }}
    >
      <Sider
        width={240}
        theme={isDark ? 'dark' : 'light'}
        style={{
          borderRight: `1px solid ${token.colorBorder}`,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <div className="linktune-sider__header">
          <img src={logoImg} alt="LinkTune" className="linktune-sider__logo" />
          <Typography.Title level={4} style={{ color: token.colorText, margin: 0 }}>
            LinkTune
          </Typography.Title>
          <Typography.Text style={{ color: token.colorTextSecondary }}>音乐播放 · 多协议连接</Typography.Text>
        </div>

        <div className="linktune-sider__menu">
          <Menu
            theme={isDark ? 'dark' : 'light'}
            mode="inline"
            selectedKeys={[location.pathname]}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys as string[])}
            items={menuItems}
          />
        </div>
      </Sider>

      <Layout style={{ background: token.colorBgLayout, minHeight: 0, overflow: 'hidden' }}>
        {/* 顶部拖拽条，用于拖动窗口 */}
        <div className="linktune-dragbar" />
        <Content style={{ padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route
              path="/now-playing"
              element={
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <NowPlayingPage />
                </div>
              }
            />
            <Route
              path="*"
              element={
                <>
                  <div style={{ padding: '0 20px 20px 20px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <Routes>
                      <Route path="/" element={<LibraryPage />} />
                      <Route path="/library" element={<LibraryPage />} />
                      <Route path="/playlists/:playlistId" element={<LibraryPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                  </div>
                  <PlayerBar />
                </>
              }
            />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export function App() {
  const auth = useAuth();

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {auth.isAuthenticated ? (
          <Route
            path="/*"
            element={
              <PlayerProvider>
                <Shell />
              </PlayerProvider>
            }
          />
        ) : (
          <Route path="/*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </HashRouter>
  );
}
