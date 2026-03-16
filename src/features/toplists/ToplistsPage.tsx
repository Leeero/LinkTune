import { CaretRightFilled, PictureOutlined } from '@ant-design/icons';
import { Alert, Avatar, Card, List, Space, Tag, Typography, theme } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { CUSTOM_PLAYLISTS } from '../../app/shell/customPlaylists';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { CustomPlatform } from '../../protocols/custom/library';
import { customGetToplists, type CustomToplist } from '../../protocols/custom/toplists';
import { useAuth } from '../../session/AuthProvider';

function labelForSource(source: string) {
  return CUSTOM_PLAYLISTS.find((p) => p.id === source)?.name ?? source;
}

export function ToplistsPage() {
  const { token } = theme.useToken();
  const auth = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { source: rawSource } = useParams();

  const source = typeof rawSource === 'string' ? (rawSource as CustomPlatform) : 'netease';

  const [items, setItems] = useState<CustomToplist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectionTitle = useMemo(() => {
    const c = auth.credentials;
    if (!c) return '';
    if (c.protocol === 'custom') return 'TuneHub';
    try {
      const host = new URL(c.baseUrl).host;
      return `${c.protocol.toUpperCase()} · ${host}`;
    } catch {
      return c.protocol.toUpperCase();
    }
  }, [auth.credentials]);

  useEffect(() => {
    const c = auth.credentials;
    if (!c || c.protocol !== 'custom') return;

    let alive = true;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    customGetToplists({ credentials: c, platform: source, signal: controller.signal })
      .then((list) => {
        if (!alive) return;
        setItems(list);
      })
      .catch((e) => {
        if (!alive) return;
        if (controller.signal.aborted) return;
        const msg = e instanceof Error ? e.message : '获取热门榜单失败';
        setError(msg);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [auth.credentials, source]);

  if (!auth.credentials || auth.credentials.protocol !== 'custom') {
    return (
      <div className={isMobile ? 'mobile-page' : 'linktune-page'}>
        <Alert type="warning" showIcon message="热门榜单仅支持 TuneHub 协议" style={{ borderRadius: 12 }} />
      </div>
    );
  }

  const sourceLabel = labelForSource(source);

  // 移动端布局
  if (isMobile) {
    return (
      <div className="mobile-page">
        {/* 页面标题 */}
        <div className="mobile-page__header">
          <h1 className="mobile-page__title">{sourceLabel}榜单</h1>
          <p className="mobile-page__subtitle">
            {connectionTitle && <span>{connectionTitle} · </span>}
            共 {items.length} 个榜单
          </p>
        </div>

        {error && <Alert type="error" showIcon message={error} style={{ borderRadius: 12, marginBottom: 16 }} />}

        {/* 榜单列表 */}
        {loading ? (
          <div className="mobile-loading">
            <div className="mobile-loading__spinner" />
          </div>
        ) : items.length === 0 ? (
          <div className="mobile-empty">
            <div className="mobile-empty__icon">📊</div>
            <h3 className="mobile-empty__title">暂无榜单</h3>
            <p className="mobile-empty__desc">请稍后再试</p>
          </div>
        ) : (
          <div className="mobile-card-grid">
            {items.map((item) => (
              <div
                key={item.id}
                className="mobile-card"
                onClick={() => {
                  navigate(`/toplists/${source}/${item.id}`, {
                    state: { toplistName: item.name, sourceName: sourceLabel, platform: source },
                  });
                }}
              >
                <div className="mobile-card__cover">
                  {item.pic ? (
                    <img src={item.pic} alt={item.name} />
                  ) : (
                    <PictureOutlined style={{ fontSize: 32, color: 'rgba(255,255,255,0.6)' }} />
                  )}
                  <div className="mobile-card__cover-overlay">
                    <CaretRightFilled />
                  </div>
                </div>
                <div className="mobile-card__info">
                  <h4 className="mobile-card__title">{item.name}</h4>
                  <p className="mobile-card__subtitle">{item.updateFrequency || '更新频率未知'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 桌面端布局
  return (
    <div className="linktune-page linktune-toplists">
      {/* 页面头部 */}
      <div className="linktune-page__header" style={{ marginBottom: 24 }}>
        <Typography.Title level={2} className="linktune-page__title" style={{ marginBottom: 8 }}>
          热门榜单 · {sourceLabel}
        </Typography.Title>
        <Space size={12} wrap>
          {connectionTitle && (
            <Tag
              color="blue"
              style={{ borderRadius: 8, padding: '2px 10px' }}
            >
              {connectionTitle}
            </Tag>
          )}
          <Typography.Text type="secondary">
            共 {items.length.toLocaleString()} 个榜单
          </Typography.Text>
        </Space>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ borderRadius: 12, marginBottom: 16 }} />}

      <List
        loading={loading}
        grid={{ gutter: 16, column: 3, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
        dataSource={items}
        renderItem={(it) => {
          return (
            <List.Item>
              <Card
                hoverable
                className="linktune-toplists__card"
                style={{
                  borderColor: token.colorBorder,
                  background: token.colorBgContainer,
                }}
                onClick={() => {
                  navigate(`/toplists/${source}/${it.id}`, {
                    state: { toplistName: it.name, sourceName: sourceLabel, platform: source },
                  });
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <Avatar
                    shape="square"
                    size={64}
                    src={it.pic}
                    icon={<PictureOutlined />}
                    style={{
                      background: `linear-gradient(135deg, ${token.colorPrimary} 0%, #9D7CFF 100%)`,
                      borderRadius: 12,
                      flex: '0 0 auto',
                    }}
                    onError={() => true}
                  />

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Typography.Text
                      strong
                      ellipsis={{ tooltip: it.name }}
                      style={{ display: 'block', fontSize: 15, marginBottom: 6 }}
                    >
                      {it.name}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {it.updateFrequency || '更新频率未知'}
                    </Typography.Text>
                  </div>
                </div>
              </Card>
            </List.Item>
          );
        }}
      />
    </div>
  );
}
