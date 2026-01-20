import { message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AUDIO_QUALITY_OPTIONS,
  loadAudioQuality,
  saveAudioQuality,
  type AudioQuality,
} from '../../../config/audioQualityConfig';
import {
  getDefaultLrcApiConfig,
  loadLrcApiConfig,
  saveLrcApiConfig,
  type LrcApiConfig,
} from '../../../config/lrcApiConfig';
import { useAuth } from '../../../session/AuthProvider';
import { useThemeMode } from '../../../theme/ThemeProvider';

export function useSettingsState() {
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

  const handleAudioQualityChange = useCallback((quality: AudioQuality) => {
    setAudioQuality(quality);
    saveAudioQuality(quality);
  }, []);

  const handleLrcConfigChange = useCallback(
    (partial: Partial<LrcApiConfig>) => {
      const next = { ...lrcConfig, ...partial };
      setLrcConfig(next);
      saveLrcApiConfig(next);
    },
    [lrcConfig],
  );

  const handleTestLrcApi = useCallback(
    async (type: 'lyrics' | 'cover') => {
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
    },
    [lrcConfig.authKey, lrcConfig.coverUrl, lrcConfig.lyricsUrl],
  );

  const connectionText = useMemo(() => {
    const c = auth.credentials;
    if (!c) return '';

    try {
      const host = new URL(c.baseUrl).host;
      const serverName = 'serverName' in c && c.serverName ? ` · ${c.serverName}` : '';
      return `${c.protocol.toUpperCase()} · ${host}${serverName}`;
    } catch {
      return c.protocol.toUpperCase();
    }
  }, [auth.credentials]);

  return {
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
  };
}
