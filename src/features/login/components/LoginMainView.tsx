import {
  CloudOutlined,
  CustomerServiceOutlined,
  KeyOutlined,
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
  Form,
  Input,
  Row,
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

// 协议配置
const protocolOptions: Array<{
  id: ProtocolId;
  name: string;
  icon: React.ReactNode;
  gradient: string;
}> = [
  {
    id: 'emby',
    name: 'Emby',
    icon: <CustomerServiceOutlined />,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    id: 'navidrome',
    name: 'Navidrome',
    icon: <CloudOutlined />,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    id: 'custom',
    name: '自定义',
    icon: <KeyOutlined />,
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
];

export function LoginMainView(props: Props) {
  const { token } = theme.useToken();

  const { protocol, setProtocol, loading, error, form, placeholderBaseUrl, onSubmit } = props;

  const help = useMemo(() => {
    if (protocol === 'emby') {
      return (
        <Typography.Text style={{ color: token.colorTextSecondary, fontSize: 13 }}>
          将通过 <b>账号密码</b> 登录并获取访问令牌。
        </Typography.Text>
      );
    }

    if (protocol === 'navidrome') {
      return (
        <Typography.Text style={{ color: token.colorTextSecondary, fontSize: 13 }}>
          将通过 <b>Subsonic API</b> 校验登录（使用 <code>/rest/ping.view</code>）。
        </Typography.Text>
      );
    }

    return (
      <Typography.Text style={{ color: token.colorTextSecondary, fontSize: 13 }}>
        使用 <b>TuneHub API Key</b> 进行认证，支持网易云、QQ音乐、酷我音乐等多平台。前往{' '}
        <Typography.Link href="https://tunehub.sayqz.com" target="_blank" rel="noopener noreferrer">
          tunehub.sayqz.com
        </Typography.Link>{' '}
        获取 API Key。
      </Typography.Text>
    );
  }, [protocol, token.colorTextSecondary]);

  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: token.colorBgLayout,
      }}
    >
      {/* 动态背景 - 音波效果 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {/* 主渐变光晕 */}
        <div
          style={{
            position: 'absolute',
            width: '140%',
            height: '140%',
            top: '-20%',
            left: '-20%',
            background: `
              radial-gradient(ellipse 600px 400px at 20% 30%, rgba(64, 117, 255, 0.25), transparent 70%),
              radial-gradient(ellipse 500px 350px at 80% 20%, rgba(157, 124, 255, 0.2), transparent 60%),
              radial-gradient(ellipse 400px 300px at 60% 80%, rgba(240, 147, 251, 0.15), transparent 60%)
            `,
            animation: 'pulse 8s ease-in-out infinite',
          }}
        />
        {/* 音波圆环 */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: `${300 + i * 150}px`,
              height: `${300 + i * 150}px`,
              marginLeft: `-${(300 + i * 150) / 2}px`,
              marginTop: `-${(300 + i * 150) / 2}px`,
              borderRadius: '50%',
              border: `1px solid rgba(157, 124, 255, ${0.15 - i * 0.03})`,
              animation: `ripple ${3 + i}s ease-out infinite`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          50% { transform: scale(1.05) rotate(2deg); opacity: 0.8; }
        }
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .protocol-card {
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .protocol-card:hover {
          transform: translateY(-4px);
        }
        .protocol-card.selected {
          transform: translateY(-4px);
        }
        .login-btn {
          background: linear-gradient(135deg, #4075FF 0%, #9D7CFF 100%);
          background-size: 200% 200%;
          transition: all 0.3s ease;
        }
        .login-btn:hover:not(:disabled) {
          animation: gradientShift 2s ease infinite;
          box-shadow: 0 8px 25px rgba(64, 117, 255, 0.4);
        }
        .glass-card {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
      `}</style>

      {/* 主内容 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
        }}
      >
        <div style={{ maxWidth: 1100, width: '100%' }}>
          <Row gutter={[48, 32]} align="middle">
            {/* 左侧品牌区域 */}
            <Col xs={24} lg={12}>
              <Space direction="vertical" size={28} style={{ width: '100%' }}>
                {/* Logo 和品牌名 */}
                <div style={{ animation: 'float 6s ease-in-out infinite' }}>
                  <Space size={16} align="center">
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        background: 'linear-gradient(135deg, #4075FF 0%, #9D7CFF 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 32px rgba(64, 117, 255, 0.35)',
                      }}
                    >
                      <CustomerServiceOutlined style={{ fontSize: 28, color: '#fff' }} />
                    </div>
                    <div>
                      <Typography.Title
                        level={1}
                        style={{
                          margin: 0,
                          fontSize: 42,
                          fontWeight: 700,
                          background: 'linear-gradient(135deg, #4075FF 0%, #9D7CFF 50%, #f093fb 100%)',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          letterSpacing: '-0.02em',
                        }}
                      >
                        LinkTune
                      </Typography.Title>
                      <Typography.Text
                        style={{
                          color: token.colorTextSecondary,
                          fontSize: 14,
                          letterSpacing: '0.1em',
                        }}
                      >
                        联万物音源 · 听无损好音
                      </Typography.Text>
                    </div>
                  </Space>
                </div>

                {/* 产品描述 */}
                <Typography.Paragraph
                  style={{
                    margin: 0,
                    color: token.colorTextSecondary,
                    fontSize: 16,
                    lineHeight: 1.8,
                    maxWidth: 420,
                  }}
                >
                  多协议音乐播放器，一次登录即可将你的 Emby、Navidrome 音源，
                  以及网易云、QQ音乐、酷我等平台的音乐汇聚到同一个播放器体验。
                </Typography.Paragraph>

                {/* 特性标签 */}
                <Space size={12} wrap>
                  {['无损音质', '多平台支持', '全局歌词', '本地歌单'].map((tag) => (
                    <div
                      key={tag}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 20,
                        background: `rgba(64, 117, 255, 0.1)`,
                        border: `1px solid rgba(64, 117, 255, 0.2)`,
                        color: token.colorPrimary,
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {tag}
                    </div>
                  ))}
                </Space>

                {/* 安全提示卡片 */}
                <Card
                  className="glass-card"
                  size="small"
                  style={{
                    background: `rgba(${token.colorBgContainer === '#FFFFFF' ? '255,255,255' : '20,27,45'}, 0.6)`,
                    borderColor: `rgba(157, 124, 255, 0.2)`,
                    borderRadius: 16,
                    maxWidth: 420,
                  }}
                >
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Space size={10}>
                      <SafetyCertificateOutlined style={{ color: '#00C48C', fontSize: 18 }} />
                      <Typography.Text style={{ color: token.colorText, fontWeight: 600 }}>
                        安全保障
                      </Typography.Text>
                    </Space>
                    <Typography.Text style={{ color: token.colorTextSecondary, fontSize: 13 }}>
                      我们不会持久化保存明文密码，仅保存必要的登录令牌。所有数据均存储在本地。
                    </Typography.Text>
                  </Space>
                </Card>
              </Space>
            </Col>

            {/* 右侧登录卡片 */}
            <Col xs={24} lg={12}>
              <Card
                className="glass-card"
                style={{
                  background: `rgba(${token.colorBgContainer === '#FFFFFF' ? '255,255,255' : '20,27,45'}, 0.7)`,
                  borderColor: `rgba(157, 124, 255, 0.15)`,
                  borderRadius: 24,
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
                }}
                styles={{
                  body: { padding: '32px' },
                }}
              >
                <Space direction="vertical" size={24} style={{ width: '100%' }}>
                  {/* 标题 */}
                  <div>
                    <Typography.Title level={3} style={{ margin: 0, color: token.colorText }}>
                      连接你的音乐库
                    </Typography.Title>
                    <Typography.Text style={{ color: token.colorTextSecondary }}>
                      选择协议开始你的音乐之旅
                    </Typography.Text>
                  </div>

                  {/* 协议选择器 - 卡片式 */}
                  <div>
                    <Typography.Text
                      style={{ color: token.colorTextSecondary, fontSize: 13, marginBottom: 12, display: 'block' }}
                    >
                      选择连接协议
                    </Typography.Text>
                    <Row gutter={[12, 12]}>
                      {protocolOptions.map((opt) => (
                        <Col xs={8} key={opt.id}>
                          <div
                            className={`protocol-card ${protocol === opt.id ? 'selected' : ''}`}
                            onClick={() => setProtocol(opt.id)}
                            style={{
                              padding: '16px 12px',
                              borderRadius: 14,
                              textAlign: 'center',
                              background:
                                protocol === opt.id
                                  ? opt.gradient
                                  : `rgba(${token.colorBgContainer === '#FFFFFF' ? '0,0,0' : '255,255,255'}, 0.05)`,
                              border: `2px solid ${
                                protocol === opt.id
                                  ? 'transparent'
                                  : `rgba(${token.colorBgContainer === '#FFFFFF' ? '0,0,0' : '255,255,255'}, 0.1)`
                              }`,
                              boxShadow: protocol === opt.id ? '0 8px 24px rgba(64, 117, 255, 0.3)' : 'none',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 22,
                                marginBottom: 6,
                                color: protocol === opt.id ? '#fff' : token.colorTextSecondary,
                              }}
                            >
                              {opt.icon}
                            </div>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: 14,
                                color: protocol === opt.id ? '#fff' : token.colorText,
                              }}
                            >
                              {opt.name}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: protocol === opt.id ? 'rgba(255,255,255,0.8)' : token.colorTextTertiary,
                                marginTop: 4,
                              }}
                            >
                              {protocolTagline(opt.id)}
                            </div>
                          </div>
                        </Col>
                      ))}
                    </Row>
                    <div style={{ marginTop: 12 }}>{help}</div>
                  </div>

                  {error ? <Alert type="error" showIcon message={error} style={{ borderRadius: 12 }} /> : null}

                  {/* 表单 */}
                  <Form<LoginFormValues>
                    form={form}
                    layout="vertical"
                    requiredMark={false}
                    initialValues={{ username: '', password: '', apiKey: '' }}
                    onFinish={() => void onSubmit()}
                  >
                    {protocol !== 'custom' && (
                      <Form.Item
                        label={
                          <span style={{ color: token.colorText, fontWeight: 500 }}>服务器地址</span>
                        }
                        name="baseUrl"
                        rules={[
                          { required: true, message: '请输入服务器地址' },
                          {
                            validator: async (_, v) => {
                              if (!v) return;
                              try {
                                new URL(
                                  /^https?:\/\//i.test(String(v).trim())
                                    ? String(v).trim()
                                    : `http://${String(v).trim()}`
                                );
                              } catch {
                                throw new Error('地址格式不正确（例如 192.168.1.2:8096 或 https://example.com）');
                              }
                            },
                          },
                        ]}
                      >
                        <Input
                          prefix={<CloudOutlined style={{ color: token.colorTextTertiary }} />}
                          placeholder={placeholderBaseUrl}
                          autoCapitalize="none"
                          autoCorrect="off"
                          inputMode="url"
                          size="large"
                          style={{ borderRadius: 12 }}
                        />
                      </Form.Item>
                    )}

                    {protocol === 'custom' && (
                      <Form.Item
                        label={<span style={{ color: token.colorText, fontWeight: 500 }}>API Key</span>}
                        name="apiKey"
                        rules={[{ required: true, message: '请输入 API Key' }]}
                        extra={
                          <span style={{ color: token.colorTextTertiary, fontSize: 12 }}>
                            格式：th_your_api_key_here
                          </span>
                        }
                      >
                        <Input.Password
                          prefix={<KeyOutlined style={{ color: token.colorTextTertiary }} />}
                          placeholder="th_xxxxxxxxxx"
                          autoCapitalize="none"
                          autoCorrect="off"
                          size="large"
                          style={{ borderRadius: 12 }}
                        />
                      </Form.Item>
                    )}

                    {protocol !== 'custom' && (
                      <Row gutter={12}>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            label={<span style={{ color: token.colorText, fontWeight: 500 }}>用户名</span>}
                            name="username"
                            rules={[{ required: true, message: '请输入用户名' }]}
                          >
                            <Input
                              prefix={<UserOutlined style={{ color: token.colorTextTertiary }} />}
                              autoCapitalize="none"
                              autoCorrect="off"
                              size="large"
                              style={{ borderRadius: 12 }}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            label={<span style={{ color: token.colorText, fontWeight: 500 }}>密码</span>}
                            name="password"
                            rules={[{ required: true, message: '请输入密码' }]}
                            extra={
                              protocol === 'navidrome' ? (
                                <span style={{ color: token.colorTextTertiary, fontSize: 12 }}>
                                  不会存储明文密码
                                </span>
                              ) : undefined
                            }
                          >
                            <Input.Password
                              prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />}
                              size="large"
                              style={{ borderRadius: 12 }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}

                    <Space style={{ marginTop: 8, width: '100%' }} direction="vertical" size={12}>
                      <Button
                        className="login-btn"
                        type="primary"
                        icon={<LoginOutlined />}
                        loading={loading}
                        htmlType="submit"
                        size="large"
                        block
                        style={{
                          height: 48,
                          borderRadius: 14,
                          fontWeight: 600,
                          fontSize: 15,
                          border: 'none',
                        }}
                      >
                        连接 {protocolLabel(protocol)}
                      </Button>
                      <Button
                        onClick={() => form.resetFields()}
                        disabled={loading}
                        size="large"
                        block
                        style={{
                          height: 44,
                          borderRadius: 12,
                          background: 'transparent',
                          borderColor: token.colorBorder,
                        }}
                      >
                        清空表单
                      </Button>
                    </Space>

                    <Typography.Text
                      style={{
                        color: token.colorTextTertiary,
                        fontSize: 12,
                        display: 'block',
                        textAlign: 'center',
                        marginTop: 16,
                      }}
                    >
                      提示：局域网服务建议填写 <b>http</b> 地址；外网反代建议使用 <b>https</b>
                    </Typography.Text>
                  </Form>
                </Space>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  );
}
