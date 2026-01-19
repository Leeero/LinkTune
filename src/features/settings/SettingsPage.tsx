import { Button, Card, Descriptions, Input, Radio, Space, Switch, Tag, Typography, message, theme } from 'antd';
import { useEffect, useState } from 'react';

import {
  AUDIO_QUALITY_OPTIONS,
  loadAudioQuality,
  saveAudioQuality,
  type AudioQuality,
} from '../../config/audioQualityConfig';
import { loadLrcApiConfig, saveLrcApiConfig, getDefaultLrcApiConfig, type LrcApiConfig } from '../../config/lrcApiConfig';
import { useAuth } from '../../session/AuthProvider';
import { useThemeMode } from '../../theme/ThemeProvider';

export function SettingsPage() {
  const { token } = theme.useToken();
  const { mode, setMode } = useThemeMode();
  const auth = useAuth();
  const [useHardwareAcceleration, setUseHardwareAcceleration] = useState(true);

  const [lrcConfig, setLrcConfig] = useState<LrcApiConfig>(() => loadLrcApiConfig());
  const [audioQuality, setAudioQuality] = useState<AudioQuality>(() => loadAudioQuality());

  useEffect(() => {
    setLrcConfig(loadLrcApiConfig());
    setAudioQuality(loadAudioQuality());
  }, []);

  // 监听 storage 事件，同步其他组件修改的音质设置
  useEffect(() => {
    const handleStorageChange = () => {
      setAudioQuality(loadAudioQuality());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleAudioQualityChange = (quality: AudioQuality) => {
    setAudioQuality(quality);
    saveAudioQuality(quality);
  };

  const handleLrcConfigChange = (partial: Partial<LrcApiConfig>) => {
    const next = { ...lrcConfig, ...partial };
    setLrcConfig(next);
    saveLrcApiConfig(next);
  };

  const handleTestLrcApi = async (type: 'lyrics' | 'cover') => {
    const url = type === 'lyrics' ? lrcConfig.lyricsUrl : lrcConfig.coverUrl;
    if (!url) {
      message.warning(`请先输入${type === 'lyrics' ? '歌词' : '封面'} API 地址`);
      return;
    }

    try {
      const testUrl = `${url.replace(/\/$/, '')}?title=test&artist=test`;
      const headers: HeadersInit = {};
      if (lrcConfig.authKey) {
        headers['Authorization'] = lrcConfig.authKey;
      }
      const res = await fetch(testUrl, { headers, method: 'HEAD' });
      if (res.ok || res.status === 404) {
        message.success('连接成功');
      } else if (res.status === 403) {
        message.error('鉴权失败，请检查 Auth Key');
      } else {
        message.error(`连接失败: ${res.status}`);
      }
    } catch {
      message.error('连接失败，请检查地址是否正确');
    }
  };

  const connectionText = (() => {
    const c = auth.credentials;
    if (!c) return '';

    try {
      const host = new URL(c.baseUrl).host;
      const serverName = c.serverName ? ` · ${c.serverName}` : '';
      return `${c.protocol.toUpperCase()} · ${host}${serverName}`;
    } catch {
      return c.protocol.toUpperCase();
    }
  })();

  return (
    <div className="linktune-settings">
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={3} style={{ color: token.colorText, marginBottom: 4 }}>
            设置
          </Typography.Title>
          <Space size={8} wrap>
            <Typography.Text style={{ color: token.colorTextSecondary }}>
              {typeof window !== 'undefined' && window.linkTune
                ? `Electron ${window.linkTune.versions.electron} · ${window.linkTune.platform}`
                : 'Web 模式'}
            </Typography.Text>
            {auth.isAuthenticated ? <Tag color="blue">{connectionText}</Tag> : null}
          </Space>
        </div>

        {auth.isAuthenticated ? (
          <Button onClick={() => auth.logout()}>退出</Button>
        ) : null}
      </div>

      <Descriptions
        bordered
        column={1}
        size="middle"
        labelStyle={{ width: 240, color: token.colorTextSecondary }}
        contentStyle={{ color: token.colorText }}
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'theme',
            label: '深色模式',
            children: <Switch checked={mode === 'dark'} onChange={(v) => setMode(v ? 'dark' : 'light')} />,
          },
          {
            key: 'audio-quality',
            label: '播放音质',
            children: (
              <Radio.Group
                value={audioQuality}
                onChange={(e) => handleAudioQualityChange(e.target.value)}
              >
                <Space direction="vertical" size={4}>
                  {AUDIO_QUALITY_OPTIONS.map((opt) => (
                    <Radio key={opt.value} value={opt.value}>
                      <span>{opt.label}</span>
                      <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                        {opt.description}
                      </Typography.Text>
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            ),
          },
          {
            key: 'hw',
            label: '硬件加速（示例项）',
            children: <Switch checked={useHardwareAcceleration} onChange={(v) => setUseHardwareAcceleration(v)} />,
          },
        ]}
      />

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
            children: (
              <Switch
                checked={lrcConfig.enabled}
                onChange={(v) => handleLrcConfigChange({ enabled: v })}
              />
            ),
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
                    onChange={(e) => handleLrcConfigChange({ lyricsUrl: e.target.value })}
                    disabled={!lrcConfig.enabled}
                  />
                  <Button onClick={() => handleTestLrcApi('lyrics')} disabled={!lrcConfig.enabled}>
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
                    onChange={(e) => handleLrcConfigChange({ coverUrl: e.target.value })}
                    disabled={!lrcConfig.enabled}
                  />
                  <Button onClick={() => handleTestLrcApi('cover')} disabled={!lrcConfig.enabled}>
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
                onChange={(e) => handleLrcConfigChange({ authKey: e.target.value })}
                disabled={!lrcConfig.enabled}
                style={{ maxWidth: 480 }}
              />
            ),
          },
        ]}
      />
    </Card>
    </div>
  );
}
