export function normalizeBaseUrl(input: string) {
  const trimmed = input.trim();
  // 保留用户的 scheme；如果未填，默认 http（局域网/自建服务更常见）
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  const url = new URL(withScheme);
  // 去掉末尾 /
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/+$/, '');
}
