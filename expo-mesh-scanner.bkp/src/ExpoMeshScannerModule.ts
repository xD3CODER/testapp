import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import { NativeEventEmitter } from 'react-native';

// Enum pour les modes de capture
export enum CaptureModeType {
  OBJECT = 'object',
  AREA = 'area'
}

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

// La classe du module natif
class ExpoObjectCaptureModuleClass {
  // Référence au module natif
  private nativeModule: any;
  private eventEmitter: NativeEventEmitter;

  constructor() {
    try {
      this.nativeModule = requireNativeModule('ExpoObjectCapture');
      console.log('Module natif chargé:', !!this.nativeModule);
      console.log('Méthodes disponibles:', Object.keys(this.nativeModule).join(', '));
      this.eventEmitter = new NativeEventEmitter(this.nativeModule);
    } catch (error) {
      console.error('Erreur lors du chargement du module natif:', error);
      throw error;
    }
  }

  // Méthodes synchrones
  isSupported(): boolean {
    return true;
  }

  getCurrentState(): { state: string } {
    return { state: 'ready' };
  }

  getImageCount(): number {
    try {
      if (this.nativeModule.getImageCount) {
        return this.nativeModule.getImageCount() || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error in getImageCount:', error);
      return 0;
    }
  }

  // Définir le mode de capture
  setCaptureMode(mode: CaptureModeType): void {
    try {
      if (this.nativeModule.setCaptureMode) {
        this.nativeModule.setCaptureMode(mode);
      }
    } catch (error) {
      console.error('Error in setCaptureMode:', error);
    }
  }

  // Méthodes asynchrones avec gestion des erreurs robuste
  async startNewCapture(): Promise<boolean> {
    try {
      console.log("Démarrage d'une nouvelle capture...");
      const sessionCreated = await this.createCaptureSession();
      console.log("Session créée:", sessionCreated);

      if (sessionCreated) {
        const sessionAttached = await this.attachSessionToView();
        console.log("Session attachée:", sessionAttached);
        return sessionAttached;
      }
      return false;
    } catch (error) {
      console.error('Error in startNewCapture:', error);
      return false;
    }
  }

  // Méthodes stub pour compatibilité avec l'ancienne API
  async startDetecting(): Promise<boolean> {
    return true;
  }

  async startCapturing(): Promise<boolean> {
    return true;
  }

  async startReconstruction(): Promise<boolean> {
    return true;
  }

  // Méthode principale pour démarrer la capture
  async startCapture(options?: ObjectCaptureOptions): Promise<ObjectCaptureResult> {
    if (!this.nativeModule.startCapture || !this.nativeModule.captureComplete) {
      throw new Error('startCapture or captureComplete not available in native module');
    }

    try {
      console.log("Démarrage de la capture avec options:", options);
      // Appeler la méthode native pour démarrer la capture modale
      this.nativeModule.startCapture(options || {});

      // Attendre que la capture soit terminée
      const result = await this.nativeModule.captureComplete();
      console.log("Résultat de la capture:", result);

      return result as ObjectCaptureResult;
    } catch (error) {
      console.error('Error in startCapture:', error);
      throw error;
    }
  }

  // Créer une session de capture
  async createCaptureSession(): Promise<boolean> {
    try {
      console.log("Création d'une session de capture...");
      if (this.nativeModule.createCaptureSession) {
        return await this.nativeModule.createCaptureSession();
      }
      console.error('createCaptureSession not available in native module');
      return false;
    } catch (error) {
      console.error('Error in createCaptureSession:', error);
      return false;
    }
  }

  // Attacher la session à la vue
  async attachSessionToView(): Promise<boolean> {
    try {
      console.log("Attachement de la session à la vue...");
      if (this.nativeModule.attachSessionToView) {
        return await this.nativeModule.attachSessionToView();
      }
      console.error('attachSessionToView not available in native module');
      return false;
    } catch (error) {
      console.error('Error in attachSessionToView:', error);
      return false;
    }
  }

  // Terminer la session de capture
  async finishCapture(): Promise<boolean> {
    try {
      console.log("Fin de la session de capture...");
      if (this.nativeModule.finishCaptureSession) {
        return await this.nativeModule.finishCaptureSession();
      }
      return true;
    } catch (error) {
      console.error('Error in finishCapture:', error);
      return false;
    }
  }

  // Annuler la session de capture
  async cancelCapture(): Promise<boolean> {
    try {
      console.log("Annulation de la session de capture...");
      if (this.nativeModule.cancelCaptureSession) {
        return await this.nativeModule.cancelCaptureSession();
      }
      return true;
    } catch (error) {
      console.error('Error in cancelCapture:', error);
      return false;
    }
  }

  // Méthode pour obtenir le nombre d'images de manière asynchrone
  async getImageCountAsync(): Promise<number> {
    try {
      if (this.nativeModule.getImageCountAsync) {
        return await this.nativeModule.getImageCountAsync();
      }
      return this.getImageCount();
    } catch (error) {
      console.error('Error in getImageCountAsync:', error);
      return 0;
    }
  }

  // Gestion des écouteurs d'événements
  addStateChangeListener(callback: (event: StateChangeEvent) => void) {
    return this.eventEmitter.addListener('onStateChanged', callback);
  }

  addFeedbackListener(callback: (event: FeedbackEvent) => void) {
    return this.eventEmitter.addListener('onFeedbackChanged', callback);
  }

  addProgressListener(callback: (event: ProgressEvent) => void) {
    return this.eventEmitter.addListener('onProcessingProgress', callback);
  }

  addModelCompleteListener(callback: (event: ModelCompleteEvent) => void) {
    return this.eventEmitter.addListener('onModelComplete', callback);
  }

  addErrorListener(callback: (event: ErrorEvent) => void) {
    return this.eventEmitter.addListener('onError', callback);
  }

  removeAllListeners() {
    this.eventEmitter.removeAllListeners('onStateChanged');
    this.eventEmitter.removeAllListeners('onFeedbackChanged');
    this.eventEmitter.removeAllListeners('onProcessingProgress');
    this.eventEmitter.removeAllListeners('onModelComplete');
    this.eventEmitter.removeAllListeners('onError');
  }
}

// Créer une instance unique du module
const moduleInstance = new ExpoObjectCaptureModuleClass();

// Exporter l'instance comme module par défaut
export default moduleInstance;

// Exporter la vue native
export const ObjectCaptureView = requireNativeViewManager('ExpoObjectCapture');

// Exporter les fonctions individuelles
export const createCaptureSession = () => moduleInstance.createCaptureSession();
export const attachSessionToView = () => moduleInstance.attachSessionToView();
export const startCapture = (options?: ObjectCaptureOptions) => moduleInstance.startCapture(options);
export const getImageCountAsync = () => moduleInstance.getImageCountAsync();
export const finishCapture = () => moduleInstance.finishCapture();
export const cancelCapture = () => moduleInstance.cancelCapture();