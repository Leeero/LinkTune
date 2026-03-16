import { 
  LogoutOutlined,
  MoonOutlined,
  RightOutlined,
  SoundOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { App, Card, Radio, Space, Switch, Typography, theme } from 'antd';

import { useIsMobile } from '../../hooks/useIsMobile';
import { LrcServiceSettings } from './components/LrcServiceSettings';
import { SettingsHeader } from './components/SettingsHeader';
import { useSettingsState } from './hooks/useSettingsState';

export function SettingsPage() {
  const { token } = theme.useToken();
  const isMobile = useIsMobile();
  const { modal, message } = App.useApp();

  const {
    auth,
    mode,
    setMode,
    useHardwareAcceleration,
    setUseHardwareAcceleration,
    lrcConfig,
    audioQuality,
    audioQualityOptions,
    getDefaultLrcApiConfig,
    handleAudioQualityChange,
    handleLrcConfigChange,
    handleTestLrcApi,
    connectionText,
  } = useSettingsState();

  // 移动端退出登录
  const handleLogout = () => {
    modal.confirm({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      okText: '退出',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        auth.logout();
        message.success('已退出登录');
      },
    });
  };

  // 移动端音质选择
  const handleQualitySelect = () => {
    modal.confirm({
      title: '选择播放音质',
      icon: null,
      content: (
        <Radio.Group
          value={audioQuality}
          onChange={(e) => handleAudioQualityChange(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {audioQualityOptions.map((opt) => (
              <Radio key={opt.value} value={opt.value} style={{ width: '100%' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{opt.label}</span>
                  <span style={{ display: 'block', fontSize: 12, color: token.colorTextTertiary }}>
                    {opt.description}
                  </span>
                </div>
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      ),
      okText: '确定',
      cancelText: '取消',
    });
  };

  // 移动端布局
  if (isMobile) {
    const currentQualityLabel = audioQualityOptions.find((o) => o.value === audioQuality)?.label || '标准';

    return (
      <div className="mobile-page">
        {/* 页面标题 */}
        <div className="mobile-page__header">
          <h1 className="mobile-page__title">设置</h1>
        </div>

        {/* 账户信息 */}
        <div className="mobile-settings-group">
          <div className="mobile-settings-group__title">账户</div>
          <div className="mobile-settings-list">
            <div className="mobile-settings-item">
              <div className="mobile-settings-item__left">
                <div className="mobile-settings-item__label">当前连接</div>
              </div>
              <span className="mobile-settings-item__value">{connectionText}</span>
            </div>
            <button
              type="button"
              className="mobile-settings-item"
              onClick={handleLogout}
              style={{ width: '100%', cursor: 'pointer', background: 'transparent', border: 'none' }}
            >
              <div className="mobile-settings-item__left">
                <div 
                  className="mobile-settings-item__icon" 
                  style={{ background: 'linear-gradient(135deg, #ff6b6b 0%, #ff4757 100%)' }}
                >
                  <LogoutOutlined />
                </div>
                <span className="mobile-settings-item__label" style={{ color: '#ff4757' }}>
                  退出登录
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* 外观设置 */}
        <div className="mobile-settings-group">
          <div className="mobile-settings-group__title">外观</div>
          <div className="mobile-settings-list">
            <div className="mobile-settings-item">
              <div className="mobile-settings-item__left">
                <div className="mobile-settings-item__icon">
                  <MoonOutlined />
                </div>
                <span className="mobile-settings-item__label">深色模式</span>
              </div>
              <Switch 
                checked={mode === 'dark'} 
                onChange={(v) => setMode(v ? 'dark' : 'light')} 
              />
            </div>
          </div>
        </div>

        {/* 播放设置 */}
        <div className="mobile-settings-group">
          <div className="mobile-settings-group__title">播放</div>
          <div className="mobile-settings-list">
            <button
              type="button"
              className="mobile-settings-item"
              onClick={handleQualitySelect}
              style={{ width: '100%', cursor: 'pointer', background: 'transparent', border: 'none' }}
            >
              <div className="mobile-settings-item__left">
                <div className="mobile-settings-item__icon">
                  <SoundOutlined />
                </div>
                <span className="mobile-settings-item__label">播放音质</span>
              </div>
              <span className="mobile-settings-item__value">{currentQualityLabel}</span>
              <RightOutlined className="mobile-settings-item__arrow" />
            </button>

            <div className="mobile-settings-item">
              <div className="mobile-settings-item__left">
                <div className="mobile-settings-item__icon">
                  <ThunderboltOutlined />
                </div>
                <span className="mobile-settings-item__label">硬件加速</span>
              </div>
              <Switch 
                checked={useHardwareAcceleration} 
                onChange={(v) => setUseHardwareAcceleration(v)} 
              />
            </div>
          </div>
        </div>

        {/* 歌词服务 */}
        <div className="mobile-settings-group">
          <div className="mobile-settings-group__title">歌词服务</div>
          <div className="mobile-settings-list" style={{ padding: 16 }}>
            <LrcServiceSettings
              lrcConfig={lrcConfig}
              getDefaultLrcApiConfig={getDefaultLrcApiConfig}
              onChange={handleLrcConfigChange}
              onTest={handleTestLrcApi}
            />
          </div>
        </div>

        {/* 关于 */}
        <div className="mobile-settings-group">
          <div className="mobile-settings-group__title">关于</div>
          <div className="mobile-settings-list">
            <div className="mobile-settings-item">
              <div className="mobile-settings-item__left">
                <span className="mobile-settings-item__label">版本</span>
              </div>
              <span className="mobile-settings-item__value">1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 桌面端布局
  return (
    <div className="linktune-page linktune-settings">
      {/* 页面头部 */}
      <div className="linktune-page__header" style={{ marginBottom: 24 }}>
        <Typography.Title level={2} style={{ marginBottom: 8 }}>
          设置
        </Typography.Title>
        <Typography.Text type="secondary">
          自定义你的播放体验
        </Typography.Text>
      </div>

      {/* 账户卡片 */}
      <Card
        className="linktune-settings__card"
        style={{
          borderRadius: 16,
          marginBottom: 16,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorder}`,
        }}
      >
        <SettingsHeader
          isAuthenticated={auth.isAuthenticated}
          connectionText={connectionText}
          onLogout={() => auth.logout()}
        />
      </Card>

      {/* 外观设置 */}
      <Card
        className="linktune-settings__card"
        title={
          <Typography.Text strong style={{ fontSize: 16 }}>
            🎨 外观
          </Typography.Text>
        }
        style={{
          borderRadius: 16,
          marginBottom: 16,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorder}`,
        }}
      >
        <div className="linktune-settings__row">
          <div className="linktune-settings__rowLabel">
            <Typography.Text strong>深色模式</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              开启后界面将切换为深色主题
            </Typography.Text>
          </div>
          <Switch checked={mode === 'dark'} onChange={(v) => setMode(v ? 'dark' : 'light')} />
        </div>
      </Card>

      {/* 播放设置 */}
      <Card
        className="linktune-settings__card"
        title={
          <Typography.Text strong style={{ fontSize: 16 }}>
            🎵 播放
          </Typography.Text>
        }
        style={{
          borderRadius: 16,
          marginBottom: 16,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorder}`,
        }}
      >
        <div className="linktune-settings__row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <Typography.Text strong>播放音质</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              更高音质需要更好的网络条件
            </Typography.Text>
          </div>
          <Radio.Group value={audioQuality} onChange={(e) => handleAudioQualityChange(e.target.value)}>
            <Space direction="vertical" size={8}>
              {audioQualityOptions.map((opt) => (
                <Radio key={opt.value} value={opt.value}>
                  <span style={{ fontWeight: 500 }}>{opt.label}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: token.colorTextTertiary }}>{opt.description}</span>
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </div>

        <div className="linktune-settings__divider" style={{ margin: '16px 0', borderTop: `1px solid ${token.colorBorderSecondary}` }} />

        <div className="linktune-settings__row">
          <div className="linktune-settings__rowLabel">
            <Typography.Text strong>硬件加速</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              使用 GPU 加速渲染（示例项）
            </Typography.Text>
          </div>
          <Switch checked={useHardwareAcceleration} onChange={(v) => setUseHardwareAcceleration(v)} />
        </div>
      </Card>

      {/* 歌词服务设置 */}
      <Card
        className="linktune-settings__card"
        title={
          <Typography.Text strong style={{ fontSize: 16 }}>
            📝 歌词服务
          </Typography.Text>
        }
        style={{
          borderRadius: 16,
          marginBottom: 16,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorder}`,
        }}
      >
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
