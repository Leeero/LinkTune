import type { ProtocolId } from '../protocols/types';

// 音质配置

export type AudioQuality =
  | 'low'
  | 'medium'
  | 'high'
  | 'lossless'
  | '128k'
  | '320k'
  | 'flac'
  | 'flac24bit';

export interface AudioQualityOption {
  value: AudioQuality;
  label: string;
  description: string;
  /** 最大码率 (bps)，undefined 表示不限制（无损） */
  maxBitrate?: number;
}

const EMBY_QUALITY_OPTIONS: AudioQualityOption[] = [
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

const CUSTOM_QUALITY_OPTIONS: AudioQualityOption[] = [
  {
    value: '128k',
    label: '标准音质',
    description: '128kbps',
    maxBitrate: 128_000,
  },
  {
    value: '320k',
    label: '高品质',
    description: '320kbps',
    maxBitrate: 320_000,
  },
  {
    value: 'flac',
    label: '无损音质',
    description: '~1000kbps',
    maxBitrate: 1_000_000,
  },
  {
    value: 'flac24bit',
    label: 'Hi-Res 音质',
    description: '~1400kbps',
    maxBitrate: 1_400_000,
  },
];

export const AUDIO_QUALITY_OPTIONS_BY_PROTOCOL: Record<ProtocolId, AudioQualityOption[]> = {
  emby: EMBY_QUALITY_OPTIONS,
  navidrome: EMBY_QUALITY_OPTIONS,
  custom: CUSTOM_QUALITY_OPTIONS,
};

const STORAGE_KEY = 'linktune_audio_quality_v2';
const LEGACY_STORAGE_KEY = 'linktune_audio_quality';

const DEFAULT_QUALITY_BY_PROTOCOL: Record<ProtocolId, AudioQuality> = {
  emby: 'high',
  navidrome: 'high',
  custom: '320k',
};

function normalizeQuality(protocol: ProtocolId, value: string | null | undefined): AudioQuality | null {
  if (!value) return null;
  const options = AUDIO_QUALITY_OPTIONS_BY_PROTOCOL[protocol];
  const hit = options.find((o) => o.value === value);
  if (hit) return hit.value;

  if (protocol === 'custom') {
    if (value === 'low') return '128k';
    if (value === 'medium') return '320k';
    if (value === 'high') return '320k';
    if (value === 'lossless') return 'flac';
  }

  return null;
}

export function getAudioQualityOptions(protocol: ProtocolId): AudioQualityOption[] {
  return AUDIO_QUALITY_OPTIONS_BY_PROTOCOL[protocol];
}

export function loadAudioQuality(protocol: ProtocolId): AudioQuality {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as Partial<Record<ProtocolId, AudioQuality>>;
      const normalized = normalizeQuality(protocol, data?.[protocol]);
      if (normalized) return normalized;
    }
  } catch {
    // ignore
  }

  // 兼容旧版本
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const normalized = normalizeQuality(protocol, legacy);
    if (normalized) return normalized;
  } catch {
    // ignore
  }

  return DEFAULT_QUALITY_BY_PROTOCOL[protocol];
}

export function saveAudioQuality(protocol: ProtocolId, quality: AudioQuality): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const data = stored ? (JSON.parse(stored) as Partial<Record<ProtocolId, AudioQuality>>) : {};
    data[protocol] = quality;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function getMaxBitrate(protocol: ProtocolId, quality: AudioQuality): number | undefined {
  const option = AUDIO_QUALITY_OPTIONS_BY_PROTOCOL[protocol].find((o) => o.value === quality);
  return option?.maxBitrate;
}
