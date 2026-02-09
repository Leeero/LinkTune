import { Form, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { embyLoginWithPassword } from '../../../protocols/emby/auth';
import { navidromeLoginSubsonic } from '../../../protocols/navidrome/auth';
import type { ProtocolId } from '../../../protocols/types';
import { useAuth } from '../../../session/AuthProvider';
import { getPlaceholderBaseUrl, protocolLabel } from '../utils/protocolMeta';

export type LoginFormValues = {
  baseUrl: string;
  username: string;
  password: string;
  apiKey: string;
};

export function useLoginForm() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [protocol, setProtocol] = useState<ProtocolId>('emby');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form] = Form.useForm<LoginFormValues>();

  const devDefaults = useMemo(() => {
    if (!import.meta.env.DEV) return null;
    return {
      emby: {
        baseUrl: String(import.meta.env.VITE_DEV_EMBY_BASE_URL ?? '').trim(),
        username: String(import.meta.env.VITE_DEV_EMBY_USERNAME ?? '').trim(),
        password: String(import.meta.env.VITE_DEV_EMBY_PASSWORD ?? ''),
      },
      custom: {
        apiKey: String(import.meta.env.VITE_DEV_CUSTOM_API_KEY ?? '').trim(),
      },
    };
  }, []);

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

  useEffect(() => {
    if (!devDefaults) return;
    const values = form.getFieldsValue(['baseUrl', 'username', 'password', 'apiKey']);

    if (protocol === 'emby') {
      const updates: Partial<LoginFormValues> = {};
      if (!values.baseUrl && devDefaults.emby.baseUrl) updates.baseUrl = devDefaults.emby.baseUrl;
      if (!values.username && devDefaults.emby.username) updates.username = devDefaults.emby.username;
      if (!values.password && devDefaults.emby.password) updates.password = devDefaults.emby.password;
      if (Object.keys(updates).length) form.setFieldsValue(updates);
      return;
    }

    if (protocol === 'custom') {
      if (!values.apiKey && devDefaults.custom.apiKey) {
        form.setFieldsValue({ apiKey: devDefaults.custom.apiKey });
      }
    }
  }, [devDefaults, form, protocol]);

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

      // 自定义协议：需要 API Key
      if (!values.apiKey?.trim()) {
        throw new Error('请输入 API Key');
      }
      auth.login({
        protocol: 'custom',
        baseUrl: 'https://tunehub.sayqz.com/api',
        apiKey: values.apiKey.trim(),
      });
      message.success('已连接 TuneHub 服务');
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
