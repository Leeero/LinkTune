import { LoginOutlined } from '@ant-design/icons';
import { Button, Card, Space, Typography, theme } from 'antd';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../session/AuthProvider';

export function LoginAuthenticatedView() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const auth = useAuth();

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ color: token.colorText }}>
            已登录
          </Typography.Title>
          <Typography.Text style={{ color: token.colorTextSecondary }}>当前协议：{auth.credentials?.protocol}</Typography.Text>
          <Space>
            <Button type="primary" onClick={() => navigate('/library')} icon={<LoginOutlined />}>
              进入应用
            </Button>
            <Button danger onClick={() => auth.logout()}>
              退出登录
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
}
