import { Card, Descriptions, Radio, Space, Switch, theme } from 'antd';

import { LrcServiceSettings } from './components/LrcServiceSettings';
import { SettingsHeader } from './components/SettingsHeader';
import { useSettingsState } from './hooks/useSettingsState';

export function SettingsPage() {
  const { token } = theme.useToken();

  const {
    auth,
    mode,
    setMode,
    useHardwareAcceleration,
    setUseHardwareAcceleration,
    lrcConfig,
    audioQuality,
    AUDIO_QUALITY_OPTIONS,
    getDefaultLrcApiConfig,
    handleAudioQualityChange,
    handleLrcConfigChange,
    handleTestLrcApi,
    connectionText,
  } = useSettingsState();

  return (
    <div className="linktune-settings">
      <Card>
        <SettingsHeader
          isAuthenticated={auth.isAuthenticated}
          connectionText={connectionText}
          onLogout={() => auth.logout()}
        />

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
                <Radio.Group value={audioQuality} onChange={(e) => handleAudioQualityChange(e.target.value)}>
                  <Space direction="vertical" size={4}>
                    {AUDIO_QUALITY_OPTIONS.map((opt) => (
                      <Radio key={opt.value} value={opt.value}>
                        <span>{opt.label}</span>
                        <span style={{ marginLeft: 8, fontSize: 12, color: token.colorTextTertiary }}>{opt.description}</span>
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

        <LrcServiceSettings
          lrcConfig={lrcConfig}
          getDefaultLrcApiConfig={getDefaultLrcApiConfig}
          onChange={handleLrcConfigChange}
          onTest={handleTestLrcApi}
        />
      </Card>
    </div>
  );
}
