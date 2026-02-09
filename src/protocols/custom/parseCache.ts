/**
 * 客户端解析结果缓存
 *
 * 设计原则：
 * 1. 服务端有 5 分钟的缓存（同 API Key + 同歌曲 + 同音质），客户端也缓存 5 分钟以避免重复请求
 * 2. 缓存 key 格式：`${platform}:${songId}:${quality}`
 * 3. 解析失败不缓存（服务端不扣费，下次可能成功）
 * 4. 缓存存储解析后的 URL 和相关信息
 */

import type { ParsedSongData } from './library';

type CacheEntry = {
  data: ParsedSongData;
  cachedAt: number;
};

// 缓存过期时间：4.5 分钟（略小于服务端的 5 分钟，确保安全）
const CACHE_TTL_MS = 4.5 * 60 * 1000;

// 内存缓存
const cache = new Map<string, CacheEntry>();

/**
 * 生成缓存 key
 */
export function makeCacheKey(platform: string, songId: string, quality: string): string {
  return `${platform}:${songId}:${quality}`;
}

/**
 * 获取缓存的解析结果
 * @returns 缓存的数据（如果存在且未过期），否则返回 null
 */
export function getCachedParse(platform: string, songId: string, quality: string): ParsedSongData | null {
  const key = makeCacheKey(platform, songId, quality);
  const entry = cache.get(key);

  if (!entry) return null;

  // 检查是否过期
  const now = Date.now();
  if (now - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * 缓存解析结果
 * 只缓存成功的解析结果（服务端对失败的请求不扣费）
 */
export function setCachedParse(platform: string, songId: string, quality: string, data: ParsedSongData): void {
  // 只缓存成功的结果
  if (!data.success || !data.url) {
    return;
  }

  const key = makeCacheKey(platform, songId, quality);
  cache.set(key, {
    data,
    cachedAt: Date.now(),
  });
}

/**
 * 批量设置缓存（用于批量解析接口返回的结果）
 */
export function setCachedParseMany(platform: string, quality: string, items: ParsedSongData[]): void {
  for (const item of items) {
    if (item.success && item.url && item.id) {
      setCachedParse(platform, item.id, quality, item);
    }
  }
}

/**
 * 清除指定歌曲的缓存（用于强制刷新）
 */
export function clearCachedParse(platform: string, songId: string, quality?: string): void {
  if (quality) {
    const key = makeCacheKey(platform, songId, quality);
    cache.delete(key);
  } else {
    // 清除该歌曲所有音质的缓存
    const prefix = `${platform}:${songId}:`;
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    }
  }
}

/**
 * 清除所有过期的缓存条目
 */
export function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.cachedAt > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

/**
 * 获取缓存统计信息（用于调试）
 */
export function getCacheStats(): { size: number; validCount: number; expiredCount: number } {
  const now = Date.now();
  let validCount = 0;
  let expiredCount = 0;

  for (const entry of cache.values()) {
    if (now - entry.cachedAt > CACHE_TTL_MS) {
      expiredCount++;
    } else {
      validCount++;
    }
  }

  return { size: cache.size, validCount, expiredCount };
}

// 定期清理过期缓存（每分钟）
if (typeof window !== 'undefined') {
  setInterval(cleanExpiredCache, 60 * 1000);
}
