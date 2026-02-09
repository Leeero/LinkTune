import type { ProtocolId } from '../protocols/types';
import type { AudioQuality } from '../config/audioQualityConfig';

export type Track = {
  id: string;
  title: string;
  artist?: string;
  /** 封面（可选，后续可从协议侧补齐） */
  coverUrl?: string;
  url: string;

  protocol?: ProtocolId;
  quality?: AudioQuality;
  /** 构建播放 URL，可以是同步或异步函数 */
  buildUrl?: (quality: AudioQuality) => string | Promise<string>;

  /** 平台来源（netease/kuwo/qq），用于收藏到歌单 */
  platform?: string;
  /** 兼容旧代码的 source 字段 */
  source?: string;
  /** 艺术家数组，用于收藏到歌单 */
  artists?: string[];
};
