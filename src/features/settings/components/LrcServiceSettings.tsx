import { Button, Descriptions, Input, Space, Switch, Typography, theme } from 'antd';

import type { LrcApiConfig } from '../../../config/lrcApiConfig';

type Props = {
  lrcConfig: LrcApiConfig;
  getDefaultLrcApiConfig: () => LrcApiConfig;
  onChange: (partial: Partial<LrcApiConfig>) => void;
  onTest: (type: 'lyrics' | 'cover') => void;
};

export function LrcServiceSettings(props: Props) {
  const { token } = theme.useToken();
  const { lrcConfig, getDefaultLrcApiConfig, onChange, onTest } = props;

  return (
    <>
      <Typography.Title level={4} style={{ color: token.colorText, marginTop: 24, marginBottom: 12 }}>
        歌词与封面服务
      </Typography.Title>
      <Typography.Paragraph style={{ color: token.colorTextSecondary, marginBottom: 16 }}>
        配置后，应用将从该服务获取歌词和封面信息。推荐使用{' '}
        <Typography.Link href="https://github.com/HisAtri/LrcApi" target="_blank">
          LrcApi
        </Typography.Link>{' '}
        服务。开发环境已内置代理，可直接使用默认地址。
      </Typography.Paragraph>

      <Descriptions
        bordered
        column={1}
        size="middle"
        labelStyle={{ width: 240, color: token.colorTextSecondary }}
        contentStyle={{ color: token.colorText }}
        items={[
          {
            key: 'lrc-enabled',
            label: '启用歌词/封面服务',
            children: <Switch checked={lrcConfig.enabled} onChange={(v) => onChange({ enabled: v })} />,
          },
          {
            key: 'lrc-lyrics-url',
            label: '歌词 API 地址',
            children: (
              <div>
                <Space.Compact style={{ width: '100%', maxWidth: 480 }}>
                  <Input
                    placeholder={getDefaultLrcApiConfig().lyricsUrl}
                    value={lrcConfig.lyricsUrl}
                    onChange={(e) => onChange({ lyricsUrl: e.target.value })}
                    disabled={!lrcConfig.enabled}
                  />
                  <Button onClick={() => onTest('lyrics')} disabled={!lrcConfig.enabled}>
                    测试
                  </Button>
                </Space.Compact>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  公共 API: https://api.lrc.cx/lyrics
                </Typography.Text>
              </div>
            ),
          },
          {
            key: 'lrc-cover-url',
            label: '封面 API 地址',
            children: (
              <div>
                <Space.Compact style={{ width: '100%', maxWidth: 480 }}>
                  <Input
                    placeholder={getDefaultLrcApiConfig().coverUrl}
                    value={lrcConfig.coverUrl}
                    onChange={(e) => onChange({ coverUrl: e.target.value })}
                    disabled={!lrcConfig.enabled}
                  />
                  <Button onClick={() => onTest('cover')} disabled={!lrcConfig.enabled}>
                    测试
                  </Button>
                </Space.Compact>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  公共 API: https://api.lrc.cx/cover
                </Typography.Text>
              </div>
            ),
          },
          {
            key: 'lrc-auth',
            label: 'Auth Key（可选）',
            children: (
              <Input.Password
                placeholder="如服务需要鉴权，请填写"
                value={lrcConfig.authKey}
                onChange={(e) => onChange({ authKey: e.target.value })}
                disabled={!lrcConfig.enabled}
                style={{ maxWidth: 480 }}
              />
            ),
          },
        ]}
      />
    </>
  );
}
