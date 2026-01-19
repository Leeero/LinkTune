export type EmbyLoginMethod = 'apiKey' | 'password';

export type EmbyCredentials =
  | {
      protocol: 'emby';
      method: 'apiKey';
      /**
       * Emby API 根路径。
       * 可能是 `http://host:8096`，也可能是 `http://host:8096/emby`（取决于服务端配置/反代）。
       */
      baseUrl: string;
      apiKey: string;
      /** 设备信息（用于构造 Authorization: Emby ... 请求头） */
      deviceId: string;
      client: string;
      device: string;
      version: string;
      // 可选：探测成功后填充
      serverId?: string;
      serverName?: string;
    }
  | {
      protocol: 'emby';
      method: 'password';
      /**
       * Emby API 根路径。
       * 可能是 `http://host:8096`，也可能是 `http://host:8096/emby`（取决于服务端配置/反代）。
       */
      baseUrl: string;
      username: string;
      // 不落盘存明文密码（只在登录请求中使用）
      accessToken: string;
      userId?: string;
      /** 设备信息（用于构造 Authorization: Emby ... 请求头） */
      deviceId: string;
      client: string;
      device: string;
      version: string;
      // 可选：探测成功后填充
      serverId?: string;
      serverName?: string;
    };

export type EmbySong = {
  id: string;
  name: string;
  artists: string[];
  album?: string;
  runTimeTicks?: number;
  productionYear?: number;
};

export type EmbyPlaylist = {
  id: string;
  name: string;
  songCount?: number;
};
