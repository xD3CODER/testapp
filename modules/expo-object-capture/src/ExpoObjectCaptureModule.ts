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
class ObjectCaptureModuleClass {
  // Référence au module natif
  private nativeModule: any;
  private eventEmitter: NativeEventEmitter;

  // Gestion des abonnements d'événements
  private stateListeners: Set<(event: StateChangeEvent) => void> = new Set();
  private feedbackListeners: Set<(event: FeedbackEvent) => void> = new Set();
  private progressListeners: Set<(event: ProgressEvent) => void> = new Set();
  private modelCompleteListeners: Set<(event: ModelCompleteEvent) => void> = new Set();
  private errorListeners: Set<(event: ErrorEvent) => void> = new Set();

  // État de connexion aux événements
  private eventsConnected: boolean = false;

  constructor() {
    try {
      this.nativeModule = requireNativeModule('ExpoObjectCapture');
      console.log('Module natif chargé avec succès');
      this.eventEmitter = new NativeEventEmitter(this.nativeModule);

      // Connecter les événements
      this.connectEvents();
    } catch (error) {
      console.error('Erreur lors du chargement du module natif:', error);
      // Créer un substitut si le module natif n'est pas disponible (pour le développement)
      this.nativeModule = {
        isSupported: () => false,
        createCaptureSession: async () => false,
        attachSessionToView: async () => false,
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

      // Créer un émetteur d'événements factice
      this.eventEmitter = {
        addListener: () => ({ remove: () => {} }),
        removeAllListeners: () => {}
      } as any;
    }
  }

  // Connecter tous les événements natifs
  private connectEvents() {
    if (this.eventsConnected) return;

    // Configurer les écouteurs pour tous les types d'événements
    this.eventEmitter.addListener('onStateChanged', (event) => {
      console.log('[EventBridge] État changé:', event.state);
      this.stateListeners.forEach(listener => listener(event));
    });

    this.eventEmitter.addListener('onFeedbackChanged', (event) => {
      console.log('[EventBridge] Feedback reçu:', event.messages);
      this.feedbackListeners.forEach(listener => listener(event));
    });

    this.eventEmitter.addListener('onProcessingProgress', (event) => {
      console.log('[EventBridge] Progression:', event.progress, event.stage);
      this.progressListeners.forEach(listener => listener(event));
    });

    this.eventEmitter.addListener('onModelComplete', (event) => {
      console.log('[EventBridge] Modèle terminé:', event.modelPath);
      this.modelCompleteListeners.forEach(listener => listener(event));
    });

    this.eventEmitter.addListener('onError', (event) => {
      console.error('[EventBridge] Erreur:', event.message);
      this.errorListeners.forEach(listener => listener(event));
    });

    this.eventsConnected = true;
    console.log('[EventBridge] Tous les événements sont connectés');
  }

  // Méthodes synchrones
  isSupported(): boolean {
    try {
      if (this.nativeModule.isSupported) {
        return this.nativeModule.isSupported();
      }
      return false;
    } catch (error) {
      console.error('Erreur lors de la vérification du support:', error);
      return false;
    }
  }

 getCurrentState(): string {
    try {
      if (this.nativeModule.getCurrentState) {
        return this.nativeModule.getCurrentState();
      }
      return 'ready';
    } catch (error) {
      console.error('Erreur dans getCurrentState:', error);
      return 'ready';
    }
  }

  getImageCount(): number {
    try {
      if (this.nativeModule.getImageCount) {
        return this.nativeModule.getImageCount() || 0;
      }
      return 0;
    } catch (error) {
      console.error('Erreur dans getImageCount:', error);
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
      console.error('Erreur dans setCaptureMode:', error);
    }
  }

  // Méthodes asynchrones avec gestion des erreurs robuste
  async startNewCapture(): Promise<boolean> {
    try {
      if (this.nativeModule.createCaptureSession) {
        const sessionCreated = await this.nativeModule.createCaptureSession();
        console.log('Session créée:', sessionCreated);

        if (sessionCreated) {
          const sessionAttached = await this.nativeModule.attachSessionToView();
          console.log('Session attachée:', sessionAttached);
          return sessionAttached;
        }
        return false;
      } else {
        console.error('createCaptureSession non disponible');
        return false;
      }
    } catch (error) {
      console.error('Erreur lors du démarrage d\'une nouvelle capture:', error);
      return false;
    }
  }

  async startDetecting(): Promise<boolean> {
    try {
      if (this.nativeModule.detectObject) {
        return await this.nativeModule.detectObject();
      }
      return false;
    } catch (error) {
      console.error('Erreur lors de la détection d\'objet:', error);
      return false;
    }
  }

  async startCapturing(): Promise<boolean> {
    // Cette méthode est laissée pour la compatibilité
    return true;
  }

  async finishCapture(): Promise<boolean> {
    try {
      if (this.nativeModule.finishCapture) {
        return await this.nativeModule.finishCapture();
      }
      return false;
    } catch (error) {
      console.error('Erreur lors de la fin de la capture:', error);
      return false;
    }
  }

  async cancelCapture(): Promise<boolean> {
    try {
      if (this.nativeModule.cancelCapture) {
        return await this.nativeModule.cancelCapture();
      }
      return false;
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la capture:', error);
      return false;
    }
  }

  async resetDetection(): Promise<boolean> {
    try {
      if (this.nativeModule.resetDetection) {
        return await this.nativeModule.resetDetection();
      }
      return false;
    } catch (error) {
      console.error('Erreur lors de la réinitialisation de la détection:', error);
      return false;
    }
  }

  // Méthode principale pour démarrer la capture
  async startCapture(options?: ObjectCaptureOptions): Promise<ObjectCaptureResult> {
    try {
      // Appeler la méthode native pour démarrer la capture modale
      return await this.nativeModule.startCapture(options || {});
    } catch (error) {
      console.error('Erreur dans startCapture:', error);
      return { success: false, error: String(error) };
    }
  }

  // Créer une session de capture
  async createCaptureSession(): Promise<boolean> {
    try {
      if (this.nativeModule.createCaptureSession) {
        return await this.nativeModule.createCaptureSession();
      }
      console.error('createCaptureSession non disponible');
      return false;
    } catch (error) {
      console.error('Erreur dans createCaptureSession:', error);
      return false;
    }
  }

  // Attacher la session à la vue
  async attachSessionToView(): Promise<boolean> {
    try {
      if (this.nativeModule.attachSessionToView) {
        return await this.nativeModule.attachSessionToView();
      }
      console.error('attachSessionToView non disponible');
      return false;
    } catch (error) {
      console.error('Erreur dans attachSessionToView:', error);
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
      console.error('Erreur dans getImageCountAsync:', error);
      return 0;
    }
  }

  // Envoyer un feedback de test (utile pour le débogage)
  async sendTestFeedback(): Promise<boolean> {
    try {
      if (this.nativeModule.sendTestFeedback) {
        return await this.nativeModule.sendTestFeedback();
      }
      return false;
    } catch (error) {
      console.error('Erreur lors de l\'envoi du feedback de test:', error);
      return false;
    }
  }

  // Gestion améliorée des écouteurs d'événements
  addStateChangeListener(callback: (event: StateChangeEvent) => void) {
    this.stateListeners.add(callback);
    return {
      remove: () => {
        this.stateListeners.delete(callback);
      }
    };
  }

  addFeedbackListener(callback: (event: FeedbackEvent) => void) {
    this.feedbackListeners.add(callback);
    return {
      remove: () => {
        this.feedbackListeners.delete(callback);
      }
    };
  }

  addProgressListener(callback: (event: ProgressEvent) => void) {
    this.progressListeners.add(callback);
    return {
      remove: () => {
        this.progressListeners.delete(callback);
      }
    };
  }

  addModelCompleteListener(callback: (event: ModelCompleteEvent) => void) {
    this.modelCompleteListeners.add(callback);
    return {
      remove: () => {
        this.modelCompleteListeners.delete(callback);
      }
    };
  }

  addErrorListener(callback: (event: ErrorEvent) => void) {
    this.errorListeners.add(callback);
    return {
      remove: () => {
        this.errorListeners.delete(callback);
      }
    };
  }

  removeAllListeners() {
    this.stateListeners.clear();
    this.feedbackListeners.clear();
    this.progressListeners.clear();
    this.modelCompleteListeners.clear();
    this.errorListeners.clear();

    // Aussi supprimer les écouteurs natifs
    this.eventEmitter.removeAllListeners('onStateChanged');
    this.eventEmitter.removeAllListeners('onFeedbackChanged');
    this.eventEmitter.removeAllListeners('onProcessingProgress');
    this.eventEmitter.removeAllListeners('onModelComplete');
    this.eventEmitter.removeAllListeners('onError');

    this.eventsConnected = false;
  }
}

// Créer une instance unique du module
const moduleInstance = new ObjectCaptureModuleClass();

// Exporter l'instance comme module par défaut
export default moduleInstance;

// Exporter la vue native
export const ObjectCaptureView = requireNativeViewManager('ExpoObjectCapture');

// Exporter les fonctions individuelles (wrappers autour des méthodes de l'instance)
export const createCaptureSession = async () => moduleInstance.createCaptureSession();
export const attachSessionToView = async () => moduleInstance.attachSessionToView();
export const startCapture = async (options?: ObjectCaptureOptions) => moduleInstance.startCapture(options);
export const getImageCountAsync = async () => moduleInstance.getImageCountAsync();
export const finishCapture = async () => moduleInstance.finishCapture();
export const cancelCapture = async () => moduleInstance.cancelCapture();
export const detectObject = async () => moduleInstance.startDetecting();
export const resetDetection = async () => moduleInstance.resetDetection();
