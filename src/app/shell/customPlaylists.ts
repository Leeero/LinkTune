// 自定义协议固定歌单
export const CUSTOM_PLAYLISTS = [
  { id: 'netease', name: '网易云音乐' },
  { id: 'kuwo', name: '酷我音乐' },
  { id: 'qq', name: 'QQ音乐' },
] as const;

export type CustomPlaylistId = (typeof CUSTOM_PLAYLISTS)[number]['id'];
