// Types d'événements du module
export interface StateChangeEvent {
  state: string;
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

// Types d'événements à passer au module natif
export interface ObjectCaptureModuleEvents {
  onStateChanged: (event: StateChangeEvent) => void;
  onFeedbackChanged: (event: FeedbackEvent) => void;
  onProcessingProgress: (event: ProgressEvent) => void;
  onModelComplete: (event: ModelCompleteEvent) => void;
  onError: (event: ErrorEvent) => void;
}