import { Form, message } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { embyLoginWithPassword } from '../../../protocols/emby/auth';
import { navidromeLoginSubsonic } from '../../../protocols/navidrome/auth';
import type { ProtocolId } from '../../../protocols/types';
import { useAuth } from '../../../session/AuthProvider';
import { normalizeBaseUrl } from '../utils/normalizeBaseUrl';
import { getPlaceholderBaseUrl, protocolLabel } from '../utils/protocolMeta';

export type LoginFormValues = {
  baseUrl: string;
  username: string;
  password: string;
};

export function useLoginForm() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [protocol, setProtocol] = useState<ProtocolId>('emby');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form] = Form.useForm<LoginFormValues>();

  const placeholderBaseUrl = useMemo(() => getPlaceholderBaseUrl(protocol), [protocol]);

  const onProtocolChange = useCallback(
    (p: ProtocolId) => {
      setProtocol(p);
      setError(null);
      // 切协议只清空"可能不兼容"的字段，保留输入体验
      form.setFieldsValue({ password: '' });
    },
    [form],
  );

  const onSubmit = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const values = await form.validateFields();

      if (protocol === 'emby') {
        const cred = await embyLoginWithPassword(values);
        auth.login(cred);
        message.success(`已登录 ${protocolLabel(protocol)}${cred.serverName ? ` · ${cred.serverName}` : ''}`);
        navigate('/library');
        return;
      }

      if (protocol === 'navidrome') {
        const cred = await navidromeLoginSubsonic(values);
        auth.login(cred);
        message.success(`已登录 ${protocolLabel(protocol)}`);
        navigate('/library');
        return;
      }

      // 自定义协议：只需要 baseUrl
      auth.login({
        protocol: 'custom',
        baseUrl: normalizeBaseUrl(values.baseUrl),
      });
      message.success('已连接自定义服务');
      navigate('/library');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '登录失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [auth, form, navigate, protocol]);

  return {
    auth,
    protocol,
    setProtocol: onProtocolChange,
    loading,
    error,
    form,
    placeholderBaseUrl,
    onSubmit,
  };
}
