import ExpoObjectCaptureModule from './src/ExpoObjectCaptureModule';
export default ExpoObjectCaptureModule;

// Exporter la vue native
export { ObjectCaptureView } from './src/ExpoObjectCaptureModule';

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
} from './src/ExpoObjectCaptureModule';

export { CaptureModeType } from './src/ExpoObjectCaptureModule';

// Exporter des méthodes de l'instance pour la compatibilité
export const {
  isSupported,
  getCurrentState,
  getImageCount,
  setCaptureMode,
  startNewCapture,
  startDetecting,
  startCapturing,
  startReconstruction,
  removeAllListeners,
  addStateChangeListener,
  addFeedbackListener,
  addProgressListener,
  addModelCompleteListener,
  addErrorListener
} = ExpoObjectCaptureModule;