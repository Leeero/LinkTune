import type { Track } from '../types';

// 虚拟队列窗口大小：只在 state 中保留当前播放歌曲前后各 WINDOW_SIZE 首
const WINDOW_SIZE = 50;

export function pickRandomIndex(len: number, excludeIndex: number) {
  if (len <= 1) return excludeIndex;

  let next = excludeIndex;
  // 最小实现：简单重试，避免选中同一首
  for (let i = 0; i < 8 && next === excludeIndex; i += 1) {
    next = Math.floor(Math.random() * len);
  }
  if (next === excludeIndex) next = (excludeIndex + 1) % len;
  return next;
}

/** 从完整列表中提取虚拟窗口 */
export function extractWindow(fullList: Track[], globalIndex: number): { window: Track[]; windowIndex: number; windowStart: number } {
  const len = fullList.length;
  if (len === 0) return { window: [], windowIndex: 0, windowStart: 0 };

  const safeIndex = Math.max(0, Math.min(globalIndex, len - 1));
  const windowStart = Math.max(0, safeIndex - WINDOW_SIZE);
  const windowEnd = Math.min(len, safeIndex + WINDOW_SIZE + 1);
  const window = fullList.slice(windowStart, windowEnd);
  const windowIndex = safeIndex - windowStart;

  return { window, windowIndex, windowStart };
}
