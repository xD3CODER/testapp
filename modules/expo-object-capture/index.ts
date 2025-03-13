import ExpoObjectCaptureModule from './src/ExpoObjectCaptureModule';
export default ExpoObjectCaptureModule;

// Exporter la vue native
export { default as ObjectCaptureView } from "./src/ExpoObjectCaptureView"

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
  addStateChangeListener,
  addFeedbackListener,
  addProgressListener,
  addModelCompleteListener,
  addErrorListener,
  removeAllListeners
} from './src/ExpoObjectCaptureModule';

// Exporter les types et enums
export type {
  StateChangeEvent,
  FeedbackEvent,
  ProgressEvent,
  ModelCompleteEvent,
  ErrorEvent,
  ObjectCaptureOptions,
  ObjectCaptureResult
} from './src/ExpoObjectCapture.types';

export { CaptureModeType } from './src/ExpoObjectCapture.types';

// Exporter des méthodes de l'instance pour la compatibilité
export const {
  isSupported,
  getCurrentState,
  getImageCount,
  setCaptureMode,
  startNewCapture,
  startDetecting,
  startCapturing
} = ExpoObjectCaptureModule;