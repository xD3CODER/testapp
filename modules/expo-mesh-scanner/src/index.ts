// modules/expo-mesh-scanner/index.ts
import { EventEmitter, requireNativeModule } from 'expo-modules-core';

// Define event data types
export interface ScanStateChangedEvent {
  state: string;
}

export interface ScanProgressUpdateEvent {
  feedback: string;
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

export interface SupportInfoEvent {
  supported: boolean;
  reason?: string;
}

// Define scan options
export interface ScanOptions {
  enableOverCapture?: boolean;
  highQualityMode?: boolean;
}

// Define reconstruction options
export interface ReconstructionOptions {
  detailLevel?: 'low' | 'medium' | 'high';
}

// Get the native module
const ExpoMeshScannerModule = requireNativeModule('ExpoMeshScanner');

// Create an event emitter
const emitter = new EventEmitter(ExpoMeshScannerModule);

// Create the JavaScript API
export default {
  // Check if device supports Object Capture
  async checkSupport(): Promise<SupportInfoEvent> {
    return await ExpoMeshScannerModule.checkSupport();
  },

  // Start a new scan session
  async startScan(options: ScanOptions = {}): Promise<{ success: boolean; imagesPath: string }> {
    return await ExpoMeshScannerModule.startScan(options);
  },

  // Start detecting the object
  async startDetecting(): Promise<{ success: boolean }> {
    return await ExpoMeshScannerModule.startDetecting();
  },

  // Start capturing images
  async startCapturing(): Promise<{ success: boolean }> {
    return await ExpoMeshScannerModule.startCapturing();
  },

  // Finish scan after completion
  async finishScan(): Promise<{ success: boolean }> {
    return await ExpoMeshScannerModule.finishScan();
  },

  // Cancel the scan
  async cancelScan(): Promise<{ success: boolean }> {
    return await ExpoMeshScannerModule.cancelScan();
  },

  // Generate 3D model from captured images
  async reconstructModel(options: ReconstructionOptions = {}): Promise<{
    success: boolean;
    modelPath: string;
    previewPath: string;
  }> {
    return await ExpoMeshScannerModule.reconstructModel(options);
  },

  // Get current scan state
  getScanState(): { state: string; progress: number; isCompleted: boolean } {
    return ExpoMeshScannerModule.getScanState();
  },

  // Event listeners
  onScanStateChanged(listener: (event: ScanStateChangedEvent) => void) {
    return emitter.addListener('onScanStateChanged', listener);
  },

  onScanProgressUpdate(listener: (event: ScanProgressUpdateEvent) => void) {
    return emitter.addListener('onScanProgressUpdate', listener);
  },

  onScanComplete(listener: () => void) {
    return emitter.addListener('onScanComplete', listener);
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

  removeAllListeners() {
    emitter.removeAllListeners('onScanStateChanged');
    emitter.removeAllListeners('onScanProgressUpdate');
    emitter.removeAllListeners('onScanComplete');
    emitter.removeAllListeners('onReconstructionProgress');
    emitter.removeAllListeners('onReconstructionComplete');
    emitter.removeAllListeners('onScanError');
  }
};

// Export the view component
export { default as ExpoMeshScannerView } from './src/ExpoMeshScannerView';