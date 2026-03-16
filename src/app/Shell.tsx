import { Menu, Typography, theme } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import logoImg from '../assets/logo.png';
import { MobileBottomNav, MobileFullPlayer, MobileMiniPlayer } from '../components/mobile';
import { HistoryPage } from '../features/history/HistoryPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { LocalPlaylistDetailPage } from '../features/local-playlists/LocalPlaylistDetailPage';
import { LocalPlaylistsPage } from '../features/local-playlists/LocalPlaylistsPage';
import { NowPlayingPage } from '../features/now-playing/NowPlayingPage';
import { EmbyPlaylistsPage } from '../features/playlists/EmbyPlaylistsPage';
import { SearchPage } from '../features/search/SearchPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ToplistSongsPage } from '../features/toplists/ToplistSongsPage';
import { ToplistsPage } from '../features/toplists/ToplistsPage';
import { useIsMobile } from '../hooks/useIsMobile';
import { PlayerBar } from '../player/components/PlayerBar';
import { usePlayer } from '../player/PlayerContext';
import { useGlobalShortcuts } from '../player/hooks/useGlobalShortcuts';
import { useAuth } from '../session/AuthProvider';
import { useShellUiStore } from '../stores/shellUiStore';
import { usePlaylistsStore } from '../stores/playlistsStore';
import { useThemeMode } from '../theme/ThemeProvider';
import { buildShellMenuItems } from './shell/buildShellMenuItems';
import { useEmbyPlaylists } from './shell/useEmbyPlaylists';

export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const auth = useAuth();
  const player = usePlayer();
  const isMobile = useIsMobile();

  // 启用全局快捷键（仅桌面端）
  useGlobalShortcuts();

  const isDark = mode === 'dark';
  const isEmby = auth.credentials?.protocol === 'emby';
  const isCustom = auth.credentials?.protocol === 'custom';

  const { playlists, loading: playlistsLoading, error: playlistsError } = useEmbyPlaylists(auth.credentials);

  const localPlaylists = usePlaylistsStore((s) => s.localPlaylists);
  const localInitialized = usePlaylistsStore((s) => s.localInitialized);
  const fetchLocalPlaylists = usePlaylistsStore((s) => s.fetchLocalPlaylists);
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);

  // 本地歌单：首次加载 + 路由变化时刷新
  useEffect(() => {
    if (isCustom) {
      void fetchLocalPlaylists();
    }
  }, [isCustom, fetchLocalPlaylists]);

  useEffect(() => {
    if (isCustom && localInitialized) {
      void fetchLocalPlaylists();
    }
  }, [location.pathname, isCustom, localInitialized, fetchLocalPlaylists]);

  // 路由变化时关闭移动端全屏播放器
  useEffect(() => {
    if (location.pathname === '/now-playing') {
      setMobilePlayerOpen(false);
    }
  }, [location.pathname]);

  // 计算菜单选中的 key
  const selectedKeys = useMemo(() => {
    const path = location.pathname;

    // 榜单歌曲详情页：/toplists/qq/123 -> 选中 /toplists/qq
    const toplistMatch = path.match(/^\/toplists\/([^/]+)\/[^/]+$/);
    if (toplistMatch) {
      return [`/toplists/${toplistMatch[1]}`];
    }

    return [path];
  }, [location.pathname]);

  const openKeys = useShellUiStore((s) => s.openKeys);
  const setOpenKeys = useShellUiStore((s) => s.setOpenKeys);
  const ensureOpen = useShellUiStore((s) => s.ensureOpen);

  // custom 协议：默认展开榜单菜单
  useEffect(() => {
    if (isCustom) {
      ensureOpen('/toplists');
    }
  }, [ensureOpen, isCustom]);

  useEffect(() => {
    if (location.pathname.startsWith('/toplists/')) {
      ensureOpen('/toplists');
    }
  }, [ensureOpen, location.pathname]);

  const menuItems = useMemo(() => {
    return buildShellMenuItems({
      isCustom,
      isEmby,
      playlists,
      playlistsLoading,
      playlistsError,
      localPlaylists,
    });
  }, [isCustom, isEmby, localPlaylists, playlists, playlistsError, playlistsLoading]);

  // 侧边栏内容组件
  const SidebarContent = (
    <>
      <div className="linktune-sider__header">
        <div className="linktune-sider__brand">
          <div className="linktune-sider__logoWrap">
            <img src={logoImg} alt="LinkTune" className="linktune-sider__logo" />
          </div>
          <div className="linktune-sider__brandText">
            <Typography.Title level={4} className="linktune-sider__title">
              LinkTune
            </Typography.Title>
            <Typography.Text className="linktune-sider__subtitle">
              联万物音源
            </Typography.Text>
          </div>
        </div>
      </div>

      <div className="linktune-sider__menu">
        <Menu
          theme={isDark ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onOpenChange={(keys) => setOpenKeys(keys as string[])}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key);
          }}
        />
      </div>
    </>
  );

  // 检查是否在 now-playing 页面
  const isNowPlayingPage = location.pathname === '/now-playing';
  // 是否有当前播放的歌曲
  const hasCurrentTrack = !!player.currentTrack;

  return (
    <div
      className={`linktune-app ${isDark ? 'linktune-app--dark' : 'linktune-app--light'}`}
      data-theme={isDark ? 'dark' : 'light'}
      style={{
        background: token.colorBgLayout,
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* 动态背景 */}
      <div className="linktune-app__bg">
        <div className="linktune-app__bgGlow linktune-app__bgGlow--1" />
        <div className="linktune-app__bgGlow linktune-app__bgGlow--2" />
        <div className="linktune-app__bgGlow linktune-app__bgGlow--3" />
      </div>

      {/* 桌面端侧边栏 */}
      {!isMobile && (
        <aside
          className="linktune-sidebar"
        >
          {SidebarContent}
        </aside>
      )}

      {/* 主内容区 */}
      <main className="linktune-main">
        {/* 桌面端顶部拖拽条 */}
        {!isMobile && (
          <div className="linktune-topbar">
            <div className="linktune-topbar__drag" />
          </div>
        )}

        {/* 移动端顶部区域（仅在非 now-playing 页面显示） */}
        {isMobile && !isNowPlayingPage && (
          <div className="linktune-topbar linktune-topbar--mobile" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
            <div className="linktune-topbar__brand">
              <img src={logoImg} alt="LinkTune" className="linktune-topbar__logo" />
              <span className="linktune-topbar__brandName">LinkTune</span>
            </div>
            <div className="linktune-topbar__drag" />
          </div>
        )}

        {/* 页面内容 */}
        <div className="linktune-content">
          <Routes>
            <Route
              path="/now-playing"
              element={
                <div className="linktune-content__fullPage">
                  <NowPlayingPage />
                </div>
              }
            />
            <Route
              path="*"
              element={
                <>
                  <div 
                    className={`linktune-content__scroll ${isMobile ? 'linktune-content__scroll--mobile' : ''}`}
                    style={isMobile ? {
                      paddingBottom: hasCurrentTrack 
                        ? 'calc(var(--mobile-nav-height) + var(--mobile-mini-player-height) + env(safe-area-inset-bottom, 0px) + 24px)'
                        : 'calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px) + 24px)',
                    } : undefined}
                  >
                    <Routes>
                      <Route path="/" element={isCustom ? <Navigate to="/toplists/netease" replace /> : <LibraryPage />} />
                      <Route path="/library" element={isCustom ? <Navigate to="/toplists/netease" replace /> : <LibraryPage />} />
                      <Route path="/search" element={<SearchPage />} />
                      <Route path="/history" element={<HistoryPage />} />
                      <Route path="/playlists" element={<EmbyPlaylistsPage />} />
                      <Route path="/playlists/:playlistId" element={<LibraryPage />} />
                      <Route path="/local-playlists" element={<LocalPlaylistsPage />} />
                      <Route path="/local-playlists/:playlistId" element={<LocalPlaylistDetailPage />} />
                      <Route path="/toplists/:source" element={<ToplistsPage />} />
                      <Route path="/toplists/:source/:toplistId" element={<ToplistSongsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                  </div>
                  {/* 桌面端播放器底栏 */}
                  {!isMobile && <PlayerBar />}
                </>
              }
            />
          </Routes>
        </div>

        {/* 移动端迷你播放器 */}
        {isMobile && hasCurrentTrack && !isNowPlayingPage && (
          <div onClick={() => setMobilePlayerOpen(true)}>
            <MobileMiniPlayer />
          </div>
        )}

        {/* 移动端底部导航 */}
        {isMobile && !isNowPlayingPage && (
          <MobileBottomNav />
        )}
      </main>

      {/* 移动端全屏播放器 */}
      {isMobile && (
        <MobileFullPlayer
          open={mobilePlayerOpen}
          onClose={() => setMobilePlayerOpen(false)}
        />
      )}
    </div>
  );
}
