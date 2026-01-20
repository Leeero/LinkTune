export function normalizeBaseUrl(baseUrl: string) {
  let next = String(baseUrl).trim();
  if (!/^https?:\/\//i.test(next)) {
    next = `http://${next}`;
  }
  // 移除尾部斜杠
  next = next.replace(/\/+$/, '');
  return next;
}
