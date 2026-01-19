import type { EmbyCredentials } from './types';

export function buildEmbyAudioUniversalUrl(params: {
  credentials: EmbyCredentials;
  itemId: string;
  maxStreamingBitrate?: number;
}) {
  const { credentials, itemId } = params;
  const token = credentials.method === 'password' ? credentials.accessToken : credentials.apiKey;

  const q = new URLSearchParams();
  // 让 <audio> 可用：用 query 方式带 token（等价于 api_key / X-Emby-Token）
  q.set('api_key', token);

  if (credentials.method === 'password' && credentials.userId) {
    q.set('UserId', credentials.userId);
  }

  if (params.maxStreamingBitrate) {
    q.set('MaxStreamingBitrate', String(params.maxStreamingBitrate));
  }

  return `${credentials.baseUrl}/Audio/${encodeURIComponent(itemId)}/universal?${q.toString()}`;
}
