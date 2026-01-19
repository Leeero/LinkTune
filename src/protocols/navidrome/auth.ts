import md5 from 'blueimp-md5';

import type { NavidromeCredentials } from './types';
import { fetchJson } from '../../core/http/fetchJson';
import { normalizeBaseUrl } from '../../core/http/url';
import { randomSalt } from '../../core/utils/random';

type SubsonicResponse = {
  'subsonic-response'?: {
    status?: 'ok' | 'failed';
    error?: { code?: number; message?: string };
  };
};

export async function navidromeLoginSubsonic(params: {
  baseUrl: string;
  username: string;
  password: string;
  client?: string;
  version?: string;
}): Promise<NavidromeCredentials> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  const client = params.client?.trim() || 'LinkTune';
  const version = params.version?.trim() || '1.16.1';
  const salt = randomSalt(6);
  const token = md5(`${params.password}${salt}`);

  const url =
    `${baseUrl}/rest/ping.view` +
    `?u=${encodeURIComponent(params.username)}` +
    `&t=${encodeURIComponent(token)}` +
    `&s=${encodeURIComponent(salt)}` +
    `&v=${encodeURIComponent(version)}` +
    `&c=${encodeURIComponent(client)}` +
    `&f=json`;

  const json = await fetchJson<SubsonicResponse>(url);
  const resp = json['subsonic-response'];

  if (!resp) {
    throw new Error('登录失败：未识别的 Subsonic 响应（请检查是否开启 Subsonic API）');
  }
  if (resp.status !== 'ok') {
    throw new Error(resp.error?.message || '登录失败：Subsonic API 返回 failed');
  }

  return {
    protocol: 'navidrome',
    method: 'subsonic',
    baseUrl,
    username: params.username,
    token,
    salt,
    client,
    version,
    serverName: 'Navidrome',
  };
}
