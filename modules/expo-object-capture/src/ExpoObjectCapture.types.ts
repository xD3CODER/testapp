// Types d'événements du module
export interface StateChangeEvent {
  state: string;
}

export interface CameraTrackingChangeEvent {
  state: string;
}

export interface NumberOfShootsChangeEvent {
  number: number;
}

export interface FeedbackEvent {
  messages: string[];
}

export interface ProgressEvent {
  progress: number;
  stage?: string;
  timeRemaining?: number;
}

export interface ModelCompleteEvent {
  modelPath: string;
  previewPath: string;
}

export interface ErrorEvent {
  message: string;
}

// Interface pour les options de configuration
export interface ObjectCaptureOptions {
  captureMode?: CaptureModeType;
  [key: string]: any;
}

// Interface pour les résultats de la capture
export interface ObjectCaptureResult {
  success: boolean;
  modelUrl?: string;
  previewUrl?: string;
  imageCount?: number;
  timestamp?: number;
  [key: string]: any;
}

// Enum pour les modes de capture
export enum CaptureModeType {
  OBJECT = 'object',
  AREA = 'area'
}

// Types d'événements à passer au module natif
export interface ObjectCaptureModuleEvents {
  onStateChanged: (event: StateChangeEvent) => void;
  onFeedbackChanged: (event: FeedbackEvent) => void;
  onProcessingProgress: (event: ProgressEvent) => void;
  onModelComplete: (event: ModelCompleteEvent) => void;
  onError: (event: ErrorEvent) => void;
}