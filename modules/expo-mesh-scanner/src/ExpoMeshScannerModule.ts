import { EventEmitter, NativeModulesProxy, requireNativeModule } from 'expo-modules-core';

// First, get the native module
const nativeModule = requireNativeModule('ExpoMeshScanner');

// Create the proper EventEmitter to handle the events
const emitter = new EventEmitter(nativeModule);

// Create a well-typed JavaScript interface
export default {
  // Direct method calls
  checkSupport: async () => await nativeModule.checkSupport(),
  startScan: async (options) => await nativeModule.startScan(options),
  startDetecting: async () => await nativeModule.startDetecting(),
  startCapturing: async () => await nativeModule.startCapturing(),
  finishScan: async () => await nativeModule.finishScan(),
  cancelScan: async () => await nativeModule.cancelScan(),
  cleanScanDirectories: () => nativeModule.cleanScanDirectories(),
  reconstructModel: async (options) => await nativeModule.reconstructModel(options),
  getScanState: () => nativeModule.getScanState(),

  // Event listeners (these are the functions that aren't being found)
  onScanStateChanged: (listener) => emitter.addListener('onScanStateChanged', listener),
  onScanProgressUpdate: (listener) => emitter.addListener('onScanProgressUpdate', listener),
  onScanComplete: (listener) => emitter.addListener('onScanComplete', listener),
  onReconstructionProgress: (listener) => emitter.addListener('onReconstructionProgress', listener),
  onReconstructionComplete: (listener) => emitter.addListener('onReconstructionComplete', listener),
  onScanError: (listener) => emitter.addListener('onScanError', listener),

  // Utility to remove all listeners at once
  removeAllListeners: () => {
    emitter.removeAllListeners('onScanStateChanged');
    emitter.removeAllListeners('onScanProgressUpdate');
    emitter.removeAllListeners('onScanComplete');
    emitter.removeAllListeners('onReconstructionProgress');
    emitter.removeAllListeners('onReconstructionComplete');
    emitter.removeAllListeners('onScanError');
  }
};