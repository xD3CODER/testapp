import ExpoObjectCaptureModule from './src/ExpoObjectCaptureModule';
export default ExpoObjectCaptureModule;

// Exporter la vue native
export { ObjectCaptureView } from "./src/ExpoObjectCaptureView";

// Exporter l'émetteur d'événements
export { eventEmitter } from './src/ExpoObjectCaptureModule';

// Exporter les fonctions individuelles
export {
  createCaptureSession,
  attachSessionToView,
  startCapture,
  getImageCountAsync,
  finishCapture,
  cancelCapture,
  resetDetection,
  detectObject,
  navigateToReconstruction,
  addProgressListener,
  addModelCompleteListener,
  addObjectCaptureEventListener,
  addErrorListener,
  removeAllListeners
} from './src/ExpoObjectCaptureModule';

// Exporter les types et enums
export {
  AnyObjectCaptureEvent,
  CaptureState,
  CameraTrackingState,
  EventType,
  ObjectCaptureEvent,
  StateChangeEvent,
  FeedbackEvent,
  CameraTrackingEvent,
  ScanPassCompleteEvent,
  NumberOfShotsEvent,
  ObjectCaptureOptions,
  ObjectCaptureResult,
  ProgressInfo,
  ModelCompleteEvent,
  ErrorEvent,
  CaptureModeType,
  ObjectCaptureState,
  ObjectCaptureActions,
  ObjectCaptureHook
} from './src/ExpoObjectCapture.types';

// Exporter des méthodes de l'instance pour la compatibilité
export const {
  isSupported,
  getCurrentState,
  getImageCount,
  setCaptureMode,
  startNewCapture,
  startDetecting,
  startCapturing,
    getModelPath,
} = ExpoObjectCaptureModule;