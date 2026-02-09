import type { ProtocolId } from '../../../protocols/types';

export function protocolLabel(p: ProtocolId) {
  if (p === 'emby') return 'Emby';
  if (p === 'navidrome') return 'Navidrome';
  return 'TuneHub';
}

export function protocolTagline(p: ProtocolId) {
  if (p === 'emby') return '家庭媒体中心 / NAS 常用';
  if (p === 'navidrome') return 'Subsonic API · 轻量自建';
  return '多平台音乐 · API Key 认证';
}

export function getPlaceholderBaseUrl(p: ProtocolId) {
  if (p === 'emby') return '例如 http://192.168.1.2:8096';
  if (p === 'navidrome') return '例如 http://192.168.1.10:4533';
  return '';
}
