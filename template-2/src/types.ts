export interface TimedImage {
  timestamp: number;
  imageBase64: string;
}

export interface ScriptSegment {
  text: string;
  timestamp: number;
}

export interface VideoSettings {
  resolution: string;
  frameRate: number;
  quality: string;
}

export interface AudioSettings {
  format: string;
  sampleRate: number;
  channels: number;
} 