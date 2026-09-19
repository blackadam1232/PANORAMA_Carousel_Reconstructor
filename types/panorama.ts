export type Orientation = 'horizontal' | 'vertical';
export type JoinStatus = 'direct' | 'overlap' | 'possible' | 'manual';

export interface SlideItem {
  id: string;
  file: File;
  name: string;
  objectUrl: string;
  width: number;
  height: number;
  size: number;
  order: number;
}

export interface SeamState {
  leftSlideId: string;
  rightSlideId: string;
  detectedOverlap: number;
  manualOverlap: number | null;
  confidence: number;
  status: JoinStatus;
}

export interface PanoramaSettings {
  orientation: Orientation;
  jpegQuality: number;
  automaticSeamDetection: boolean;
}

export interface OutputEstimate {
  width: number;
  height: number;
  pixelCount: number;
  estimatedBytes: number;
}
