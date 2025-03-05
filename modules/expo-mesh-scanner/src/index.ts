// src/index.ts - API JavaScript complète du module ExpoMeshScanner

import ExpoMeshScannerModule, {
  MeshUpdateEvent,
  ImageCapturedEvent,
  GuidanceUpdateEvent,
  MeshCompleteEvent,
  SupportInfoEvent,
  ScanOptions,
  CaptureMode,
  ReconstructionProgressEvent,
  ReconstructionCompleteEvent
} from './ExpoMeshScannerModule';
import ExpoMeshScannerView from './ExpoMeshScannerView';
import { EventEmitter } from 'expo-modules-core';

// Créer un émetteur d'événements pour le module
const emitter = new EventEmitter(ExpoMeshScannerModule);

export {
  ExpoMeshScannerView,
  MeshUpdateEvent,
  ImageCapturedEvent,
  GuidanceUpdateEvent,
  MeshCompleteEvent,
  SupportInfoEvent,
  ScanOptions,
  CaptureMode,
  ReconstructionProgressEvent,
  ReconstructionCompleteEvent
};

// API complète exposée à JavaScript
export default {
  // Exposer les méthodes natives
  async checkSupport(): Promise<SupportInfoEvent> {
    return await ExpoMeshScannerModule.checkSupport();
  },

  // Sélectionner l'objet à scanner
  async selectObject(x: number, y: number, width: number, height: number): Promise<{ success: boolean, rect: { x: number, y: number, width: number, height: number } }> {
    return await ExpoMeshScannerModule.selectObject(x, y, width, height);
  },

  async startScan(options: ScanOptions = {}): Promise<{ success: boolean }> {
    return await ExpoMeshScannerModule.startScan(options);
  },

  async captureImage(): Promise<{ success: boolean, imageCount: number }> {
    return await ExpoMeshScannerModule.captureImage();
  },

  async stopScan(): Promise<MeshCompleteEvent> {
    return await ExpoMeshScannerModule.stopScan();
  },

  // Nouvelle API pour la reconstruction 3D avancée
  async configureReconstruction(options: {
    meshSimplificationFactor?: number;
    textureWidth?: number;
    textureHeight?: number;
    enableRefinement?: boolean;
    refinementIterations?: number;
    pointCloudDensity?: number;
  } = {}): Promise<{ success: boolean }> {
    return await ExpoMeshScannerModule.configureReconstruction(options);
  },

  async startReconstruction(): Promise<{ success: boolean }> {
    return await ExpoMeshScannerModule.startReconstruction();
  },

  async cancelReconstruction(): Promise<{ success: boolean }> {
    return await ExpoMeshScannerModule.cancelReconstruction();
  },

  async exportModel(format: 'obj' | 'glb' | 'gltf', options: {
    quality?: number;
    includeMaterials?: boolean;
  } = {}): Promise<{ success: boolean, path: string }> {
    return await ExpoMeshScannerModule.exportModel(format, options);
  },

  // Gestion des événements
  onMeshUpdate(listener: (event: MeshUpdateEvent) => void) {
    return emitter.addListener('onMeshUpdated', listener);
  },

  onImageCaptured(listener: (event: ImageCapturedEvent) => void) {
    return emitter.addListener('onImageCaptured', listener);
  },

  onGuidanceUpdate(listener: (event: GuidanceUpdateEvent) => void) {
    return emitter.addListener('onGuidanceUpdate', listener);
  },

  onScanComplete(listener: (event: MeshCompleteEvent) => void) {
    return emitter.addListener('onScanComplete', listener);
  },

  onReconstructionProgress(listener: (event: ReconstructionProgressEvent) => void) {
    return emitter.addListener('onReconstructionProgress', listener);
  },

  onReconstructionComplete(listener: (event: ReconstructionCompleteEvent) => void) {
    return emitter.addListener('onReconstructionComplete', listener);
  },

  onScanError(listener: (error: any) => void) {
    return emitter.addListener('onScanError', listener);
  },

  removeAllListeners() {
    emitter.removeAllListeners('onMeshUpdated');
    emitter.removeAllListeners('onImageCaptured');
    emitter.removeAllListeners('onGuidanceUpdate');
    emitter.removeAllListeners('onScanComplete');
    emitter.removeAllListeners('onReconstructionProgress');
    emitter.removeAllListeners('onReconstructionComplete');
    emitter.removeAllListeners('onScanError');
  }
};