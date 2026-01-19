// 音质配置

export type AudioQuality = 'low' | 'medium' | 'high' | 'lossless';

export interface AudioQualityOption {
  value: AudioQuality;
  label: string;
  description: string;
  /** 最大码率 (bps)，undefined 表示不限制（无损） */
  maxBitrate?: number;
}

export const AUDIO_QUALITY_OPTIONS: AudioQualityOption[] = [
  {
    value: 'low',
    label: '流畅',
    description: '128kbps，节省流量',
    maxBitrate: 128_000,
  },
  {
    value: 'medium',
    label: '标准',
    description: '192kbps，平衡音质与流量',
    maxBitrate: 192_000,
  },
  {
    value: 'high',
    label: '高品质',
    description: '320kbps，优质音质',
    maxBitrate: 320_000,
  },
  {
    value: 'lossless',
    label: '无损',
    description: '原始音质，不限制码率',
    maxBitrate: undefined,
  },
];

const STORAGE_KEY = 'linktune_audio_quality';

export function loadAudioQuality(): AudioQuality {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['low', 'medium', 'high', 'lossless'].includes(stored)) {
      return stored as AudioQuality;
    }
  } catch {
    // ignore
  }
  return 'high'; // 默认高品质
}

export function saveAudioQuality(quality: AudioQuality): void {
  try {
    localStorage.setItem(STORAGE_KEY, quality);
  } catch {
    // ignore
  }
}

export function getMaxBitrate(quality: AudioQuality): number | undefined {
  const option = AUDIO_QUALITY_OPTIONS.find((o) => o.value === quality);
  return option?.maxBitrate;
}
