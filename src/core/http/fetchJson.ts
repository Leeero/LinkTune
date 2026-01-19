function anySignal(signals: AbortSignal[]) {
  // AbortSignal.any 在现代浏览器可用；否则手动聚合
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Any = (AbortSignal as any).any as ((s: AbortSignal[]) => AbortSignal) | undefined;
  if (Any) return Any(signals);

  const controller = new AbortController();
  const onAbort = () => controller.abort();

  for (const s of signals) {
    if (s.aborted) {
      controller.abort();
      break;
    }
    s.addEventListener('abort', onAbort, { once: true });
  }

  return controller.signal;
}

export async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 12000): Promise<T> {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);

  const combinedSignal = init?.signal ? anySignal([init.signal, timeoutController.signal]) : timeoutController.signal;

  try {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        signal: combinedSignal,
        headers: {
          Accept: 'application/json',
          ...(init?.headers ?? {}),
        },
      });
    } catch (e) {
      // 常见：网络不可达、CORS、证书问题、被浏览器拦截
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new Error('请求已取消或超时，请检查网络/地址是否可达');
      }
      throw new Error('请求失败：可能是网络不可达或跨域（CORS）限制');
    }

    const text = await res.text();
    if (!res.ok) {
      // 兼容 Emby/Jellyfin/Subsonic 等：错误体有时是 JSON（含 Message/message/error 等字段）
      let detail = text;
      try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p = parsed as any;
          detail = p.Message || p.message || p.error || p.ErrorMessage || text;
        }
      } catch {
        // ignore
      }

      const suffix = detail ? String(detail) : `HTTP ${res.status}`;
      throw new Error(suffix);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      // 有些服务会返回非 JSON（例如 html 错误页）
      throw new Error('服务返回非 JSON，请检查地址/反代/跨域配置');
    }
  } finally {
    clearTimeout(timeout);
  }
}
