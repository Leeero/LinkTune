export type NavidromeLoginMethod = 'subsonic';

export type NavidromeCredentials = {
  protocol: 'navidrome';
  method: 'subsonic';
  baseUrl: string;
  username: string;
  // Subsonic token auth：t = md5(password + salt)
  token: string;
  salt: string;
  client: string;
  version: string;
  serverName?: string;
};
