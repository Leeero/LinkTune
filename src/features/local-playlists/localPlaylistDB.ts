/**
 * 本地歌单存储服务 - 使用 IndexedDB
 * 异步、大容量、不阻塞主线程
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type LocalPlaylistSong = {
  id: string;
  name: string;
  artists?: string[];
  source: string;
  /** 添加时间 */
  addedAt: number;
};

export type LocalPlaylist = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  songs: LocalPlaylistSong[];
};

interface LocalPlaylistDBSchema extends DBSchema {
  playlists: {
    key: string;
    value: LocalPlaylist;
    indexes: {
      'by-updated': number;
    };
  };
}

const DB_NAME = 'linktune-local-playlists';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LocalPlaylistDBSchema>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<LocalPlaylistDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('playlists', { keyPath: 'id' });
        store.createIndex('by-updated', 'updatedAt');
      },
    });
  }
  return dbPromise;
}

/**
 * 获取所有本地歌单（按更新时间倒序）
 */
export async function getLocalPlaylists(): Promise<LocalPlaylist[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('playlists', 'by-updated');
  return all.reverse(); // 最新的在前
}

/**
 * 获取单个歌单
 */
export async function getLocalPlaylist(playlistId: string): Promise<LocalPlaylist | null> {
  const db = await getDB();
  const playlist = await db.get('playlists', playlistId);
  return playlist ?? null;
}

/**
 * 创建新歌单
 */
export async function createLocalPlaylist(name: string): Promise<LocalPlaylist> {
  const db = await getDB();
  const now = Date.now();
  const newPlaylist: LocalPlaylist = {
    id: `lp_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || '未命名歌单',
    createdAt: now,
    updatedAt: now,
    songs: [],
  };
  await db.put('playlists', newPlaylist);
  return newPlaylist;
}

/**
 * 重命名歌单
 */
export async function renameLocalPlaylist(playlistId: string, newName: string): Promise<boolean> {
  const db = await getDB();
  const playlist = await db.get('playlists', playlistId);
  if (!playlist) return false;

  playlist.name = newName.trim() || '未命名歌单';
  playlist.updatedAt = Date.now();
  await db.put('playlists', playlist);
  return true;
}

/**
 * 删除歌单
 */
export async function deleteLocalPlaylist(playlistId: string): Promise<boolean> {
  const db = await getDB();
  const playlist = await db.get('playlists', playlistId);
  if (!playlist) return false;

  await db.delete('playlists', playlistId);
  return true;
}

/**
 * 添加歌曲到歌单
 */
export async function addSongToPlaylist(playlistId: string, song: LocalPlaylistSong): Promise<boolean> {
  const db = await getDB();
  const playlist = await db.get('playlists', playlistId);
  if (!playlist) return false;

  // 去重
  if (playlist.songs.some((s) => s.id === song.id && s.source === song.source)) {
    return false;
  }

  playlist.songs.push({ ...song, addedAt: Date.now() });
  playlist.updatedAt = Date.now();
  await db.put('playlists', playlist);
  return true;
}

/**
 * 批量添加歌曲到歌单
 */
export async function addSongsToPlaylist(playlistId: string, songs: LocalPlaylistSong[]): Promise<number> {
  const db = await getDB();
  const playlist = await db.get('playlists', playlistId);
  if (!playlist) return 0;

  const existingIds = new Set(playlist.songs.map((s) => `${s.source}:${s.id}`));
  const now = Date.now();
  let addedCount = 0;

  for (const song of songs) {
    const key = `${song.source}:${song.id}`;
    if (!existingIds.has(key)) {
      playlist.songs.push({ ...song, addedAt: now });
      existingIds.add(key);
      addedCount++;
    }
  }

  if (addedCount > 0) {
    playlist.updatedAt = now;
    await db.put('playlists', playlist);
  }

  return addedCount;
}

/**
 * 从歌单移除歌曲
 */
export async function removeSongFromPlaylist(playlistId: string, songId: string, source: string): Promise<boolean> {
  const db = await getDB();
  const playlist = await db.get('playlists', playlistId);
  if (!playlist) return false;

  const songIdx = playlist.songs.findIndex((s) => s.id === songId && s.source === source);
  if (songIdx < 0) return false;

  playlist.songs.splice(songIdx, 1);
  playlist.updatedAt = Date.now();
  await db.put('playlists', playlist);
  return true;
}

/**
 * 清空歌单
 */
export async function clearPlaylistSongs(playlistId: string): Promise<boolean> {
  const db = await getDB();
  const playlist = await db.get('playlists', playlistId);
  if (!playlist) return false;

  playlist.songs = [];
  playlist.updatedAt = Date.now();
  await db.put('playlists', playlist);
  return true;
}

/**
 * 从 localStorage 迁移数据到 IndexedDB（一次性）
 */
export async function migrateFromLocalStorage(): Promise<number> {
  const STORAGE_KEY = 'linktune_local_playlists';
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return 0;

  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) return 0;

    const db = await getDB();
    let count = 0;

    for (const playlist of data) {
      if (playlist && playlist.id) {
        // 检查是否已存在
        const existing = await db.get('playlists', playlist.id);
        if (!existing) {
          await db.put('playlists', playlist);
          count++;
        }
      }
    }

    // 迁移成功后删除 localStorage 数据
    if (count > 0) {
      localStorage.removeItem(STORAGE_KEY);
    }

    return count;
  } catch {
    return 0;
  }
}
