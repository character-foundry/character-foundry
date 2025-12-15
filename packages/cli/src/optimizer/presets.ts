/**
 * Optimization Presets
 *
 * Pre-configured optimization profiles for different use cases.
 */

export type PresetName = 'balanced' | 'web' | 'mobile' | 'archive';
export type ImageFormat = 'webp' | 'png' | 'jpeg';
export type AudioFormat = 'mp3' | 'ogg' | 'aac' | 'flac';
export type VideoCodec = 'libx264' | 'libx265' | 'libvpx-vp9';
export type VideoResolution = '480p' | '720p' | '1080p' | '1440p' | '4k';

export interface ImageOptions {
  format: ImageFormat;
  quality: number;
  maxDimension?: number;
  maxMegapixels?: number;
}

export interface AudioOptions {
  format: AudioFormat;
  bitrate: string;
  channels?: number;
  sampleRate?: number;
}

export interface VideoOptions {
  codec: VideoCodec;
  crf: number;
  maxResolution: VideoResolution;
  maxFps?: number;
  audioBitrate: string;
}

export interface OptimizePreset {
  name: PresetName;
  description: string;
  image: ImageOptions;
  audio: AudioOptions;
  video: VideoOptions;
}

/**
 * Resolution height limits
 */
export const RESOLUTION_MAP: Record<VideoResolution, number> = {
  '480p': 480,
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '4k': 2160,
};

/**
 * Preset configurations
 */
export const PRESETS: Record<PresetName, OptimizePreset> = {
  balanced: {
    name: 'balanced',
    description: 'Good quality/size balance (default)',
    image: {
      format: 'webp',
      quality: 85,
      maxDimension: 4096,
    },
    audio: {
      format: 'mp3',
      bitrate: '192k',
    },
    video: {
      codec: 'libx264',
      crf: 23,
      maxResolution: '1080p',
      audioBitrate: '128k',
    },
  },

  web: {
    name: 'web',
    description: 'Aggressive compression for web delivery',
    image: {
      format: 'webp',
      quality: 80,
      maxDimension: 2048,
    },
    audio: {
      format: 'mp3',
      bitrate: '128k',
    },
    video: {
      codec: 'libx264',
      crf: 28,
      maxResolution: '720p',
      audioBitrate: '96k',
    },
  },

  mobile: {
    name: 'mobile',
    description: 'Maximum compression for mobile devices',
    image: {
      format: 'webp',
      quality: 75,
      maxDimension: 1024,
    },
    audio: {
      format: 'aac',
      bitrate: '96k',
    },
    video: {
      codec: 'libx264',
      crf: 32,
      maxResolution: '480p',
      audioBitrate: '64k',
    },
  },

  archive: {
    name: 'archive',
    description: 'Preserve quality, only lossless optimization',
    image: {
      format: 'png',
      quality: 100,
      // No resize for archive
    },
    audio: {
      format: 'flac',
      bitrate: '0', // Lossless
    },
    video: {
      codec: 'libx264',
      crf: 18,
      maxResolution: '4k',
      audioBitrate: '192k',
    },
  },
};

/**
 * Get preset by name
 */
export function getPreset(name: PresetName): OptimizePreset {
  return PRESETS[name];
}

/**
 * Merge CLI options with preset defaults
 */
export function mergeOptions(
  preset: OptimizePreset,
  overrides: {
    imageFormat?: ImageFormat;
    imageQuality?: number;
    imageMaxDimension?: number;
    imageMaxMegapixels?: number;
    audioFormat?: AudioFormat;
    audioBitrate?: string;
    audioChannels?: number;
    audioSampleRate?: number;
    videoCodec?: VideoCodec;
    videoCrf?: number;
    videoMaxResolution?: VideoResolution;
    videoFps?: number;
  }
): { image: ImageOptions; audio: AudioOptions; video: VideoOptions } {
  return {
    image: {
      format: overrides.imageFormat ?? preset.image.format,
      quality: overrides.imageQuality ?? preset.image.quality,
      maxDimension: overrides.imageMaxDimension ?? preset.image.maxDimension,
      maxMegapixels: overrides.imageMaxMegapixels ?? preset.image.maxMegapixels,
    },
    audio: {
      format: overrides.audioFormat ?? preset.audio.format,
      bitrate: overrides.audioBitrate ?? preset.audio.bitrate,
      channels: overrides.audioChannels ?? preset.audio.channels,
      sampleRate: overrides.audioSampleRate ?? preset.audio.sampleRate,
    },
    video: {
      codec: overrides.videoCodec ?? preset.video.codec,
      crf: overrides.videoCrf ?? preset.video.crf,
      maxResolution: overrides.videoMaxResolution ?? preset.video.maxResolution,
      maxFps: overrides.videoFps ?? preset.video.maxFps,
      audioBitrate: preset.video.audioBitrate,
    },
  };
}
