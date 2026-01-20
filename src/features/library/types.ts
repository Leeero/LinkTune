import type { EmbySong } from '../../protocols/emby/types';
import type { CustomSong } from '../../protocols/custom/library';

// 页面/组件共用的歌曲类型
export type UnifiedSong = EmbySong | CustomSong;
