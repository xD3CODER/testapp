// Types pour les événements envoyés par le module natif vers JS

// Type d'événement principal
export enum EventType {
  STATE = 'state',
  FEEDBACK = 'feedback',
  CAMERA_TRACKING = 'cameraTracking',
  SCAN_PASS_COMPLETE = 'scanPassComplete',
  NUMBER_OF_SHOTS = 'numberOfShots',
  RECONSTRUCTION_PROGRESS = 'reconstructionProgress'
}

// Interface de base pour tous les événements
export interface ObjectCaptureEvent {
  eventType: EventType;
  data: any;
}

// États possibles de la session de capture
export enum CaptureState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  DETECTING = 'detecting',
  CAPTURING = 'capturing',
  FINISHING = 'finishing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DONE = 'done',
  RECONSTRUCTING = 'reconstructing',
  UNKNOWN = 'unknown'
}

// États possibles du suivi caméra
export enum CameraTrackingState {
  NORMAL = 'normal',
  LIMITED = 'limited',
  UNKNOWN = 'unknown'
}

// Événement de changement d'état
export interface StateChangeEvent extends ObjectCaptureEvent {
  eventType: EventType.STATE;
  data: CaptureState;
}

// Événement de changement de feedback
export interface FeedbackEvent extends ObjectCaptureEvent {
  eventType: EventType.FEEDBACK;
  data: string[];
}

// Événement de changement du progress de la reconstruction
export interface ReconstructionEvent extends ObjectCaptureEvent {
  eventType: EventType.RECONSTRUCTION_PROGRESS;
  data: number;
}

// Événement de changement de suivi caméra
export interface CameraTrackingEvent extends ObjectCaptureEvent {
  eventType: EventType.CAMERA_TRACKING;
  data: CameraTrackingState;
}

// Événement de scan pass complet
export interface ScanPassCompleteEvent extends ObjectCaptureEvent {
  eventType: EventType.SCAN_PASS_COMPLETE;
  data: boolean;
}

// Événement de changement du nombre de photos
export interface NumberOfShotsEvent extends ObjectCaptureEvent {
  eventType: EventType.NUMBER_OF_SHOTS;
  data: number;
}

// Type d'union pour tous les événements possibles
export type AnyObjectCaptureEvent =
    | StateChangeEvent
    | FeedbackEvent
    | CameraTrackingEvent
    | ScanPassCompleteEvent
    | NumberOfShotsEvent
    | ReconstructionEvent;

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

// Informations sur la progression de la reconstruction
export interface ProgressInfo {
  progress: number;
  stage?: string;
  timeRemaining?: number;
}

// Événement de complétion du modèle
export interface ModelCompleteEvent {
  modelPath: string;
  previewPath: string;
}

// Événement d'erreur
export interface ErrorEvent {
  message: string;
}

// État complet de la capture d'objet (pour le hook)
export interface ObjectCaptureState {
  state: CaptureState;
  cameraTracking: CameraTrackingState;
  imageCount?: number;
  reconstructionProgress: number;
  feedbackMessages: string[];
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  scanPassComplete: boolean;
}

// Interface pour les actions disponibles dans le hook
export interface ObjectCaptureActions {
  initialize: () => Promise<boolean>;
  detectObject: () => Promise<boolean>;
  resetDetection: () => Promise<boolean>;
  startCapture: () => Promise<void>;
  finishCapture: () => Promise<boolean>;
  cancelCapture: () => Promise<boolean>;
  navigateToReconstruction: () => Promise<boolean>;
  clearError: () => void;
}

// Type complet pour le hook useObjectCapture
export type ObjectCaptureHook = ObjectCaptureState & ObjectCaptureActions;