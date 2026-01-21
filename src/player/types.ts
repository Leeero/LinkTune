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
};
