import { PictureOutlined } from '@ant-design/icons';
import { Alert, Avatar, Card, List, Space, Tag, Typography, theme } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { CUSTOM_PLAYLISTS } from '../../app/shell/customPlaylists';
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
        // 请求取消（如路由切换 / React 严格模式 effect 重放）不算错误
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
    return <Alert type="warning" showIcon message="热门榜单仅支持 TuneHub 协议" />;
  }

  const sourceLabel = labelForSource(source);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 0 }}>
          热门榜单 · {sourceLabel}
        </Typography.Title>
        <Space size={8} wrap style={{ marginTop: 6 }}>
          {connectionTitle ? <Tag color="blue">{connectionTitle}</Tag> : null}
          <Typography.Text type="secondary">共 {items.length.toLocaleString()} 个榜单</Typography.Text>
        </Space>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <List
        loading={loading}
        grid={{ gutter: 12, column: 3, xs: 1, sm: 2, md: 3, lg: 3, xl: 4, xxl: 4 }}
        dataSource={items}
        renderItem={(it) => {
          return (
            <List.Item>
              <Card
                hoverable
                style={{ borderColor: token.colorBorder, background: token.colorBgContainer }}
                onClick={() => {
                  navigate(`/toplists/${source}/${it.id}`, {
                    state: { toplistName: it.name, sourceName: sourceLabel, platform: source },
                  });
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%' }}>
                  <Avatar
                    shape="square"
                    size={56}
                    src={it.pic}
                    icon={<PictureOutlined />}
                    style={{ background: token.colorFillQuaternary, flex: '0 0 auto' }}
                    onError={() => true}
                  />

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Typography.Text
                      strong
                      ellipsis={{ tooltip: it.name }}
                      style={{ display: 'block', maxWidth: '100%' }}
                    >
                      {it.name}
                    </Typography.Text>
                    <div style={{ marginTop: 6 }}>
                      <Typography.Text type="secondary">{it.updateFrequency || '更新频率未知'}</Typography.Text>
                    </div>
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
