import { Layout, Menu, Typography, theme } from 'antd';
import { useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import logoImg from '../assets/logo.png';
import { LibraryPage } from '../features/library/LibraryPage';
import { NowPlayingPage } from '../features/now-playing/NowPlayingPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { PlayerBar } from '../player/components/PlayerBar';
import { useAuth } from '../session/AuthProvider';
import { useShellUiStore } from '../stores/shellUiStore';
import { useThemeMode } from '../theme/ThemeProvider';
import { buildShellMenuItems } from './shell/buildShellMenuItems';
import { useEmbyPlaylists } from './shell/useEmbyPlaylists';

const { Sider, Content } = Layout;

export function Shell() {
  const location = useLocation();
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const auth = useAuth();

  const isDark = mode === 'dark';
  const isEmby = auth.credentials?.protocol === 'emby';
  const isCustom = auth.credentials?.protocol === 'custom';

  const { playlists, loading: playlistsLoading, error: playlistsError } = useEmbyPlaylists(auth.credentials);

  const openKeys = useShellUiStore((s) => s.openKeys);
  const setOpenKeys = useShellUiStore((s) => s.setOpenKeys);
  const ensureOpen = useShellUiStore((s) => s.ensureOpen);

  // custom 协议：始终展开歌单菜单
  useEffect(() => {
    if (isCustom) {
      ensureOpen('/playlists');
    }
  }, [ensureOpen, isCustom]);

  useEffect(() => {
    if (location.pathname.startsWith('/playlists/')) {
      ensureOpen('/playlists');
    }
  }, [ensureOpen, location.pathname]);

  const menuItems = useMemo(() => {
    return buildShellMenuItems({
      isCustom,
      isEmby,
      playlists,
      playlistsLoading,
      playlistsError,
    });
  }, [isCustom, isEmby, playlists, playlistsError, playlistsLoading]);

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
                      <Route path="/" element={isCustom ? <Navigate to="/playlists/netease" replace /> : <LibraryPage />} />
                      <Route path="/library" element={isCustom ? <Navigate to="/playlists/netease" replace /> : <LibraryPage />} />
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
