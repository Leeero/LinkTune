import type { ProtocolId } from '../../../protocols/types';

export function protocolLabel(p: ProtocolId) {
  if (p === 'emby') return 'Emby';
  if (p === 'navidrome') return 'Navidrome';
  return '自定义';
}

export function protocolTagline(p: ProtocolId) {
  if (p === 'emby') return '家庭媒体中心 / NAS 常用';
  if (p === 'navidrome') return 'Subsonic API · 轻量自建';
  return '仅需填写服务地址';
}

export function getPlaceholderBaseUrl(p: ProtocolId) {
  if (p === 'emby') return '例如 http://192.168.1.2:8096';
  if (p === 'navidrome') return '例如 http://192.168.1.10:4533';
  return '例如 http://192.168.1.100:8080';
}
