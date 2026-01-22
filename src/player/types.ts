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
  buildUrl?: (quality: AudioQuality) => string;

  /** 自定义协议的来源（netease/kuwo/qq），用于收藏到歌单 */
  source?: string;
  /** 艺术家数组，用于收藏到歌单 */
  artists?: string[];
};
