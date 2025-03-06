// ExpoMeshScannerModule.ts
import { EventEmitter, NativeModulesProxy, requireNativeModule } from 'expo-modules-core';

// Types d'événements
export interface ScanStateChangedEvent {
  state: string;
}

export interface FeedbackUpdatedEvent {
  messages: string[];
  hasObjectFeedback: boolean;
}

export interface ReconstructionProgressEvent {
  progress: number;
  stage: string;
}

export interface ReconstructionCompleteEvent {
  success: boolean;
  modelPath: string;
  previewPath: string;
}

export interface ScanErrorEvent {
  message: string;
}

export interface ObjectDetectedEvent {}

// Options pour le scan
export interface ScanOptions {
  captureMode?: 'object' | 'area';
  enableOverCapture?: boolean;
}

// Options pour la reconstruction
export interface ReconstructionOptions {
  detailLevel?: 'low' | 'medium' | 'high';
}

// Dimensions de l'objet
export interface ObjectDimensions {
  width?: number;
  height?: number;
  depth?: number;
}

// Obtenir le module natif
const nativeModule = requireNativeModule('ExpoMeshScanner');

// Créer un émetteur d'événements
const emitter = new EventEmitter(nativeModule);

// Créer l'interface JS
export default {
  // Vérifier le support de l'appareil
  async checkSupport(): Promise<{ supported: boolean; reason?: string }> {
    return await nativeModule.checkSupport();
  },

  // Nettoyer les dossiers de scan
  cleanScanDirectories(): boolean {
    return nativeModule.cleanScanDirectories();
  },

  // Démarrer un nouveau scan
  async startScan(options: ScanOptions = {}): Promise<{ success: boolean; imagesPath: string }> {
    return await nativeModule.startScan(options);
  },

  // Passer en mode détection
  async startDetecting(): Promise<{ success: boolean }> {
    return await nativeModule.startDetecting();
  },

  // Passer en mode capture
  async startCapturing(): Promise<{ success: boolean }> {
    return await nativeModule.startCapturing();
  },

  // Ajuster les dimensions de l'objet
  async updateObjectDimensions(dimensions: ObjectDimensions): Promise<{ success: boolean }> {
    return await nativeModule.updateObjectDimensions(dimensions);
  },

  // Terminer le scan
  async finishScan(): Promise<{ success: boolean }> {
    return await nativeModule.finishScan();
  },

  // Annuler le scan
  async cancelScan(): Promise<{ success: boolean }> {
    return await nativeModule.cancelScan();
  },

  // Reconstruire le modèle 3D
  async reconstructModel(options: ReconstructionOptions = {}): Promise<{
    success: boolean;
    modelPath: string;
    previewPath: string;
  }> {
    return await nativeModule.reconstructModel(options);
  },

  // Obtenir l'état actuel du scan
  getScanState(): {
    state: string;
    captureMode: string;
    dimensions: ObjectDimensions;
    hasPosition: boolean;
  } {
    return nativeModule.getScanState();
  },

  // Événements
  onScanStateChanged(listener: (event: ScanStateChangedEvent) => void) {
    return emitter.addListener('onScanStateChanged', listener);
  },

  onFeedbackUpdated(listener: (event: FeedbackUpdatedEvent) => void) {
    return emitter.addListener('onFeedbackUpdated', listener);
  },

  onScanComplete(listener: () => void) {
    return emitter.addListener('onScanComplete', listener);
  },

  onObjectDetected(listener: () => void) {
    return emitter.addListener('onObjectDetected', listener);
  },

  onReconstructionProgress(listener: (event: ReconstructionProgressEvent) => void) {
    return emitter.addListener('onReconstructionProgress', listener);
  },

  onReconstructionComplete(listener: (event: ReconstructionCompleteEvent) => void) {
    return emitter.addListener('onReconstructionComplete', listener);
  },

  onScanError(listener: (event: ScanErrorEvent) => void) {
    return emitter.addListener('onScanError', listener);
  },

  // Supprimer tous les écouteurs
  removeAllListeners(): void {
    emitter.removeAllListeners('onScanStateChanged');
    emitter.removeAllListeners('onFeedbackUpdated');
    emitter.removeAllListeners('onScanComplete');
    emitter.removeAllListeners('onObjectDetected');
    emitter.removeAllListeners('onReconstructionProgress');
    emitter.removeAllListeners('onReconstructionComplete');
    emitter.removeAllListeners('onScanError');
  }
};