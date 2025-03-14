import { requireNativeModule, EventEmitter } from 'expo-modules-core';
import {
  StateChangeEvent,
  FeedbackEvent,
  ProgressEvent,
  ModelCompleteEvent,
  ErrorEvent,
  ObjectCaptureOptions,
  ObjectCaptureResult,
  CaptureModeType
} from './ExpoObjectCapture.types';

// Tentative d'obtenir le module natif
let nativeModule: any;
try {
  nativeModule = requireNativeModule('ExpoObjectCapture');
  // Ajout de polyfill pour la méthode removeListeners si nécessaire
  if (!nativeModule.removeListeners) {
    nativeModule.removeListeners = (count: number) => {
      console.log('removeListeners polyfill appelé:', count);
    };
  }
  console.log('Module natif ExpoObjectCapture chargé avec succès');
} catch (error) {
  console.error('Erreur lors du chargement du module natif:', error);
  // Créer un substitut si le module natif n'est pas disponible
  nativeModule = {
    isSupported: () => false,
    createCaptureSession: async () => false,
    attachSessionToView: async () => false,
    navigateToReconstruction: async () => false,
    startCapture: async () => ({ success: false }),
    finishCapture: async () => false,
    cancelCapture: async () => false,
    getImageCount: () => 0,
    getImageCountAsync: async () => 0,
    setCaptureMode: () => {},
    getCurrentState: () => 'unsupported',
    detectObject: async () => false,
    resetDetection: async () => false,
  };
}

// Créer un émetteur d'événements
export const eventEmitter = new EventEmitter(nativeModule);

// Exporter les fonctions individuelles
export const createCaptureSession = async () => nativeModule.createCaptureSession();
export const attachSessionToView = async () => nativeModule.attachSessionToView();
export const navigateToReconstruction = async () => nativeModule.navigateToReconstruction();
export const startCapture = async () => nativeModule.startCapture();
export const getImageCountAsync = async () => nativeModule.getImageCountAsync();
export const finishCapture = async () => nativeModule.finishCapture();
export const cancelCapture = async () => nativeModule.cancelCapture();
export const detectObject = async () => nativeModule.detectObject();
export const resetDetection = async () => nativeModule.resetDetection();
export const isSupported = () => nativeModule.isSupported();
export const getCurrentState = () => nativeModule.getCurrentState();
export const getImageCount = () => nativeModule.getImageCount();
export const setCaptureMode = (mode: CaptureModeType) => nativeModule.setCaptureMode(mode);
// Fonctions helper pour ajouter des écouteurs
export function addStateChangeListener(callback: (event: StateChangeEvent) => void) {
  return eventEmitter.addListener('onStateChanged', callback);
}

export function addFeedbackListener(callback: (event: FeedbackEvent) => void) {
  return eventEmitter.addListener('onFeedbackChanged', callback);
}

export function addProgressListener(callback: (event: ProgressEvent) => void) {
  return eventEmitter.addListener('onProcessingProgress', callback);
}

export function addModelCompleteListener(callback: (event: ModelCompleteEvent) => void) {
  return eventEmitter.addListener('onModelComplete', callback);
}

export function addErrorListener(callback: (event: ErrorEvent) => void) {
  return eventEmitter.addListener('onError', callback);
}

export function removeAllListeners() {
  eventEmitter.removeAllListeners('onStateChanged');
  eventEmitter.removeAllListeners('onFeedbackChanged');
  eventEmitter.removeAllListeners('onProcessingProgress');
  eventEmitter.removeAllListeners('onModelComplete');
  eventEmitter.removeAllListeners('onError');
}

// Exporter un objet par défaut
export default {
  isSupported,
  getCurrentState,
  getImageCount,
  setCaptureMode,
  startNewCapture: createCaptureSession,
  startCapture,
  startDetecting: detectObject,
  finishCapture,
  cancelCapture,
  resetDetection,
  removeAllListeners,
  addStateChangeListener,
  addFeedbackListener,
  addProgressListener,
  addModelCompleteListener,
  addErrorListener
};