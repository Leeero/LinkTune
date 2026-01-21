import {
  CloudOutlined,
  CustomerServiceOutlined,
  LockOutlined,
  LoginOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Segmented,
  Space,
  Typography,
  theme,
} from 'antd';
import type { FormInstance } from 'antd';
import { useMemo } from 'react';

import type { ProtocolId } from '../../../protocols/types';
import type { LoginFormValues } from '../hooks/useLoginForm';
import { protocolLabel, protocolTagline } from '../utils/protocolMeta';

type Props = {
  protocol: ProtocolId;
  setProtocol: (p: ProtocolId) => void;
  loading: boolean;
  error: string | null;
  form: FormInstance<LoginFormValues>;
  placeholderBaseUrl: string;
  onSubmit: () => Promise<void>;
};

export function LoginMainView(props: Props) {
  const { token } = theme.useToken();

  const { protocol, setProtocol, loading, error, form, placeholderBaseUrl, onSubmit } = props;

  const help = useMemo(() => {
    if (protocol === 'emby') {
      return (
        <Typography.Text style={{ color: token.colorTextSecondary }}>
          将通过 <b>账号密码</b> 登录并获取访问令牌。
        </Typography.Text>
      );
    }

    if (protocol === 'navidrome') {
      return (
        <Typography.Text style={{ color: token.colorTextSecondary }}>
          将通过 <b>Subsonic API</b> 校验登录（使用 <code>/rest/ping.view</code>）。
        </Typography.Text>
      );
    }

    return (
      <Typography.Text style={{ color: token.colorTextSecondary }}>
        直接使用服务地址，<b>无需账号密码</b>。可前往{' '}
        <Typography.Link href="https://api.tunefree.fun/#intro" target="_blank" rel="noopener noreferrer">
          api.tunefree.fun
        </Typography.Link>{' '}
        获取可用服务地址。
      </Typography.Text>
    );
  }, [protocol, token.colorTextSecondary]);

  return (
    <div
      style={{
        minHeight: '100%',
        padding: '32px 16px',
        background: `radial-gradient(1200px 600px at 15% 10%, rgba(64,117,255,.22), transparent 60%),
          radial-gradient(900px 520px at 90% 25%, rgba(157,124,255,.18), transparent 55%),
          linear-gradient(180deg, ${token.colorBgLayout} 0%, ${token.colorBgLayout} 100%)`,
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <Row gutter={[18, 18]} align="middle">
          {/* 左侧品牌与卖点 */}
          <Col xs={24} md={11}>
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Space size={10} align="center">
                <CustomerServiceOutlined style={{ color: token.colorPrimary, fontSize: 28 }} />
                <Typography.Title level={2} style={{ margin: 0, color: token.colorText }}>
                  LinkTune
                </Typography.Title>
              </Space>

              <Typography.Paragraph style={{ margin: 0, color: token.colorTextSecondary, fontSize: 15 }}>
                音乐播放 · 多协议连接。一次登录，即可把你的 Emby/Navidrome 音源带进同一个播放器体验。
              </Typography.Paragraph>

              <Card
                size="small"
                style={{
                  background: 'rgba(255,255,255,.04)',
                  borderColor: token.colorBorder,
                }}
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space size={10}>
                    <SafetyCertificateOutlined style={{ color: '#00C48C' }} />
                    <Typography.Text style={{ color: token.colorText }}>安全提示</Typography.Text>
                  </Space>
                  <Typography.Text style={{ color: token.colorTextSecondary }}>
                    不会持久化保存明文密码；仅保存必要的登录令牌/派生 token。
                  </Typography.Text>
                  <Typography.Text style={{ color: token.colorTextSecondary }}>
                    若在浏览器模式访问局域网服务可能遇到跨域（CORS），建议优先用 Electron 桌面端或配置反代。
                  </Typography.Text>
                </Space>
              </Card>
            </Space>
          </Col>

          {/* 右侧登录卡片 */}
          <Col xs={24} md={13}>
            <Card
              style={{
                borderColor: token.colorBorder,
                boxShadow: token.boxShadowSecondary,
              }}
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <Typography.Title level={3} style={{ color: token.colorText }}>
                    登录
                  </Typography.Title>
                  <Typography.Text style={{ color: token.colorTextSecondary }}>选择协议并使用账号密码连接你的服务。</Typography.Text>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Typography.Text style={{ color: token.colorTextSecondary }}>协议</Typography.Text>
                  <Segmented<ProtocolId>
                    block
                    value={protocol}
                    onChange={(v) => setProtocol(v)}
                    options={[
                      {
                        value: 'emby',
                        label: (
                          <div style={{ padding: '6px 2px', textAlign: 'left' }}>
                            <div style={{ fontWeight: 600 }}>Emby</div>
                            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{protocolTagline('emby')}</div>
                          </div>
                        ),
                      },
                      {
                        value: 'navidrome',
                        label: (
                          <div style={{ padding: '6px 2px', textAlign: 'left' }}>
                            <div style={{ fontWeight: 600 }}>Navidrome</div>
                            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{protocolTagline('navidrome')}</div>
                          </div>
                        ),
                      },
                      {
                        value: 'custom',
                        label: (
                          <div style={{ padding: '6px 2px', textAlign: 'left' }}>
                            <div style={{ fontWeight: 600 }}>自定义</div>
                            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{protocolTagline('custom')}</div>
                          </div>
                        ),
                      },
                    ]}
                  />
                  {help}
                </Space>

                {error ? <Alert type="error" showIcon message={error} /> : null}

                <Form<LoginFormValues>
                  form={form}
                  layout="vertical"
                  requiredMark="optional"
                  initialValues={{ username: '', password: '' }}
                  onFinish={() => void onSubmit()}
                >
                  <Form.Item
                    label="服务器地址"
                    name="baseUrl"
                    rules={[
                      { required: true, message: '请输入服务器地址' },
                      {
                        validator: async (_, v) => {
                          if (!v) return;
                          try {
                            // 允许用户不填 scheme；默认补 http://
                            new URL(/^https?:\/\//i.test(String(v).trim()) ? String(v).trim() : `http://${String(v).trim()}`);
                          } catch {
                            throw new Error('地址格式不正确（例如 192.168.1.2:8096 或 https://example.com）');
                          }
                        },
                      },
                    ]}
                  >
                    <Input
                      prefix={<CloudOutlined />}
                      placeholder={placeholderBaseUrl}
                      autoCapitalize="none"
                      autoCorrect="off"
                      inputMode="url"
                    />
                  </Form.Item>

                  {protocol !== 'custom' && (
                    <Row gutter={12}>
                      <Col xs={24} sm={12}>
                        <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                          <Input prefix={<UserOutlined />} autoCapitalize="none" autoCorrect="off" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          label="密码"
                          name="password"
                          rules={[{ required: true, message: '请输入密码' }]}
                          extra={
                            protocol === 'navidrome' ? (
                              <span style={{ color: token.colorTextTertiary }}>不会存储明文密码；仅用于计算 Subsonic token。</span>
                            ) : undefined
                          }
                        >
                          <Input.Password prefix={<LockOutlined />} />
                        </Form.Item>
                      </Col>
                    </Row>
                  )}

                  <Space style={{ marginTop: 6 }}>
                    <Button type="primary" icon={<LoginOutlined />} loading={loading} htmlType="submit">
                      连接 {protocolLabel(protocol)}
                    </Button>
                    <Button onClick={() => form.resetFields()} disabled={loading}>
                      清空
                    </Button>
                  </Space>

                  <Divider style={{ margin: '14px 0' }} />

                  <Typography.Text style={{ color: token.colorTextTertiary }}>
                    提示：局域网服务建议填写 <b>http</b> 地址；外网反代建议使用 <b>https</b>。
                  </Typography.Text>
                </Form>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}
