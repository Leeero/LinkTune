import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * 播放历史记录
 */
export type PlayHistoryItem = {
  /** 唯一键：platform:id */
  key: string;
  /** 歌曲 ID */
  id: string;
  /** 歌曲名 */
  name: string;
  /** 歌手列表 */
  artists: string[];
  /** 平台 */
  platform: string;
  /** 封面 URL */
  coverUrl?: string;
  /** 最后播放时间戳 */
  playedAt: number;
  /** 播放次数 */
  playCount: number;
};

interface HistoryDBSchema extends DBSchema {
  history: {
    key: string;
    value: PlayHistoryItem;
    indexes: {
      'by-playedAt': number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<HistoryDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<HistoryDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<HistoryDBSchema>('linktune-history', 1, {
      upgrade(db) {
        const store = db.createObjectStore('history', { keyPath: 'key' });
        store.createIndex('by-playedAt', 'playedAt');
      },
    });
  }
  return dbPromise;
}

/**
 * 添加播放记录（如果已存在则更新播放时间和次数）
 */
export async function addPlayHistory(item: Omit<PlayHistoryItem, 'key' | 'playedAt' | 'playCount'>): Promise<void> {
  const db = await getDB();
  const key = `${item.platform}:${item.id}`;
  
  const existing = await db.get('history', key);
  
  if (existing) {
    // 更新现有记录
    existing.playedAt = Date.now();
    existing.playCount += 1;
    // 更新可能变化的信息
    existing.name = item.name;
    existing.artists = item.artists;
    if (item.coverUrl) existing.coverUrl = item.coverUrl;
    await db.put('history', existing);
  } else {
    // 新增记录
    await db.put('history', {
      ...item,
      key,
      playedAt: Date.now(),
      playCount: 1,
    });
  }

  // 保持历史记录不超过 500 条
  await trimHistory(500);
}

/**
 * 获取播放历史（按播放时间倒序）
 */
export async function getPlayHistory(limit = 100): Promise<PlayHistoryItem[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('history', 'by-playedAt');
  // 倒序返回（最近播放的在前）
  return all.reverse().slice(0, limit);
}

/**
 * 清空播放历史
 */
export async function clearPlayHistory(): Promise<void> {
  const db = await getDB();
  await db.clear('history');
}

/**
 * 删除单条历史记录
 */
export async function deleteHistoryItem(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('history', key);
}

/**
 * 限制历史记录数量
 */
async function trimHistory(maxCount: number): Promise<void> {
  const db = await getDB();
  const all = await db.getAllFromIndex('history', 'by-playedAt');
  
  if (all.length <= maxCount) return;
  
  // 删除最旧的记录
  const toDelete = all.slice(0, all.length - maxCount);
  const tx = db.transaction('history', 'readwrite');
  await Promise.all(toDelete.map((item) => tx.store.delete(item.key)));
  await tx.done;
}
