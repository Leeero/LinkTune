import { Button, Space, Tag, Typography, theme } from 'antd';

type Props = {
  isAuthenticated: boolean;
  connectionText: string;
  onLogout: () => void;
};

export function SettingsHeader(props: Props) {
  const { token } = theme.useToken();
  const { isAuthenticated, connectionText, onLogout } = props;

  const envText =
    typeof window !== 'undefined' && window.linkTune
      ? `Electron ${window.linkTune.versions.electron} · ${window.linkTune.platform}`
      : 'Web 模式';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <Typography.Title level={3} style={{ color: token.colorText, marginBottom: 4 }}>
          设置
        </Typography.Title>
        <Space size={8} wrap>
          <Typography.Text style={{ color: token.colorTextSecondary }}>{envText}</Typography.Text>
          {isAuthenticated ? <Tag color="blue">{connectionText}</Tag> : null}
        </Space>
      </div>

      {isAuthenticated ? <Button onClick={onLogout}>退出</Button> : null}
    </div>
  );
}
