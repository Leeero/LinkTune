import {
  RightOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Alert } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuth } from '../../session/AuthProvider';
import type { EmbyCredentials } from '../../protocols/emby/types';
import { usePlaylistsStore } from '../../stores/playlistsStore';

export function EmbyPlaylistsPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const listRef = useRef<HTMLDivElement>(null);

  const isEmby = auth.credentials?.protocol === 'emby';
  const credentials: EmbyCredentials | null = isEmby ? (auth.credentials as EmbyCredentials) : null;

  // 从 store 读取缓存数据
  const playlists = usePlaylistsStore((s) => s.embyPlaylists);
  const total = usePlaylistsStore((s) => s.embyTotal);
  const loading = usePlaylistsStore((s) => s.embyLoading);
  const loadingMore = usePlaylistsStore((s) => s.embyLoadingMore);
  const hasMore = usePlaylistsStore((s) => s.embyHasMore);
  const error = usePlaylistsStore((s) => s.embyError);
  const initialized = usePlaylistsStore((s) => s.embyInitialized);
  const fetchEmbyPlaylists = usePlaylistsStore((s) => s.fetchEmbyPlaylists);

  // 首次加载：仅在缓存为空时请求
  useEffect(() => {
    if (credentials && !initialized) {
      void fetchEmbyPlaylists(credentials, true);
    }
  }, [credentials, initialized, fetchEmbyPlaylists]);

  // 桌面端：如果有歌单则直接跳到第一个
  useEffect(() => {
    if (!isMobile && !loading && playlists.length > 0) {
      navigate(`/playlists/${playlists[0].id}`, {
        replace: true,
        state: { playlistName: playlists[0].name },
      });
    }
  }, [isMobile, loading, navigate, playlists]);

  // 加载更多（供滚动加载使用）
  const loadMore = useCallback(() => {
    if (credentials && hasMore && !loading && !loadingMore) {
      void fetchEmbyPlaylists(credentials, false);
    }
  }, [credentials, hasMore, loading, loadingMore, fetchEmbyPlaylists]);

  // 移动端滚动加载更多
  useEffect(() => {
    if (!isMobile) return;
    const el = listRef.current;
    if (!el) return;

    const scrollContainer = el.closest('.linktune-content__scroll') as HTMLElement | null;
    if (!scrollContainer) return;

    const onScroll = () => {
      const threshold = 300;
      const distanceToBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
      if (distanceToBottom < threshold) {
        loadMore();
      }
    };

    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', onScroll);
  }, [isMobile, loadMore]);

  // 非 Emby 协议提示
  if (!isEmby) {
    return (
      <div className="mobile-page">
        <div className="mobile-page__header">
          <h1 className="mobile-page__title">歌单</h1>
        </div>
        <div className="mobile-empty">
          <div className="mobile-empty__icon">📋</div>
          <h3 className="mobile-empty__title">当前协议不支持歌单</h3>
          <p className="mobile-empty__desc">
            仅 Emby 协议支持服务端歌单功能
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-page" ref={listRef}>
      <div className="mobile-page__header">
        <h1 className="mobile-page__title">歌单</h1>
        <p className="mobile-page__subtitle">
          {total > 0 ? `共 ${total} 个歌单` : ''}
        </p>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="加载歌单失败"
          description={error}
          style={{ borderRadius: 12, marginBottom: 16 }}
        />
      )}

      {loading ? (
        <div className="mobile-loading">
          <div className="mobile-loading__spinner" />
        </div>
      ) : playlists.length === 0 ? (
        <div className="mobile-empty">
          <div className="mobile-empty__icon">📋</div>
          <h3 className="mobile-empty__title">暂无歌单</h3>
          <p className="mobile-empty__desc">
            在 Emby 服务端创建歌单后，这里会显示
          </p>
        </div>
      ) : (
        <div className="mobile-playlist-grid">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              className="mobile-playlist-card"
              onClick={() =>
                navigate(`/playlists/${playlist.id}`, {
                  state: { playlistName: playlist.name },
                })
              }
            >
              <div className="mobile-playlist-card__icon">
                <UnorderedListOutlined />
              </div>
              <div className="mobile-playlist-card__info">
                <span className="mobile-playlist-card__name">{playlist.name}</span>
                {typeof playlist.songCount === 'number' && (
                  <span className="mobile-playlist-card__count">
                    {playlist.songCount} 首
                  </span>
                )}
              </div>
              <RightOutlined className="mobile-playlist-card__arrow" />
            </button>
          ))}

          {/* 加载更多指示器 */}
          {loadingMore && (
            <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'center' }}>
              <div className="mobile-loading__spinner" />
            </div>
          )}
          {!hasMore && playlists.length > 0 && (
            <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 13, color: 'var(--lt-text-secondary, rgba(255,255,255,0.4))' }}>
              已加载全部 {total} 个歌单
            </div>
          )}
        </div>
      )}
    </div>
  );
}
