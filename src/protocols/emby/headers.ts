function escapeQuotes(v: string) {
  return v.replaceAll('"', "'");
}

export function buildEmbyAuthorization(params: {
  userId?: string;
  client: string;
  device: string;
  deviceId: string;
  version: string;
}) {
  const parts = [
    params.userId ? `UserId="${escapeQuotes(params.userId)}"` : null,
    `Client="${escapeQuotes(params.client)}"`,
    `Device="${escapeQuotes(params.device)}"`,
    `DeviceId="${escapeQuotes(params.deviceId)}"`,
    `Version="${escapeQuotes(params.version)}"`,
  ].filter(Boolean);

  return `Emby ${parts.join(', ')}`;
}

export function buildEmbyHeaders(params: {
  accessTokenOrApiKey?: string;
  userId?: string;
  client: string;
  device: string;
  deviceId: string;
  version: string;
}) {
  const authorization = buildEmbyAuthorization({
    userId: params.userId,
    client: params.client,
    device: params.device,
    deviceId: params.deviceId,
    version: params.version,
  });

  return {
    // legacy 文档里是 Authorization；新旧客户端也常见 X-Emby-Authorization
    Authorization: authorization,
    'X-Emby-Authorization': authorization,
    ...(params.accessTokenOrApiKey ? { 'X-Emby-Token': params.accessTokenOrApiKey } : null),
  } as Record<string, string>;
}
