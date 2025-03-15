import { useState, useEffect } from 'react';
import {
    eventEmitter,
    CaptureState,
    CameraTrackingState,
    EventType,
    ObjectCaptureState,
    AnyObjectCaptureEvent,
    addObjectCaptureEventListener
} from '@/modules/expo-object-capture';

/**
 * Hook pour gérer l'état de la capture d'objet 3D
 * Utilise un seul écouteur global pour tous les événements et maintient un état complet
 *
 * @returns {ObjectCaptureState} État complet de la capture d'objet
 */
export function useObjectCaptureState(): ObjectCaptureState {
    // État unifié pour toutes les données de la capture d'objet
    const [captureState, setCaptureState] = useState<ObjectCaptureState>({
        state: CaptureState.INITIALIZING,
        cameraTracking: CameraTrackingState.NORMAL,
        imageCount: 0,
        feedbackMessages: [],
        isInitialized: false,
        isInitializing: false,
        reconstructionProgress:0,
        error: null,
        scanPassComplete: false,
        setInitializationState: () => {},
        clearError: () => {}
    });

    const [viewReady, setOnViewReady] = useState(false);

    // Configurer un seul écouteur global pour tous les événements
    useEffect(() => {
        // Écouteur principal pour les événements de capture d'objet
        const subscription = addObjectCaptureEventListener((event: AnyObjectCaptureEvent) => {
            switch (event.eventType) {
                case EventType.STATE:
                    setCaptureState(prev => ({ ...prev, state: event.data }));
                    break;

                case EventType.CAMERA_TRACKING:
                    setCaptureState(prev => ({ ...prev, cameraTracking: event.data }));
                    break;

                case EventType.NUMBER_OF_SHOTS:
                    setCaptureState(prev => ({ ...prev, imageCount: event.data }));
                    break;

                case EventType.FEEDBACK:
                    setCaptureState(prev => ({ ...prev, feedbackMessages: event.data }));
                    break;

                case EventType.SCAN_PASS_COMPLETE:
                    setCaptureState(prev => ({ ...prev, scanPassComplete: event.data }));
                    break;

                case EventType.RECONSTRUCTION_PROGRESS:
                    setCaptureState(prev => ({ ...prev, reconstructionProgress: event.data }));
                    break;


                default:
                    console.log('Événement non géré:', event);
            }
        });

        // Définir les méthodes de gestion d'état
        const setInitializationState = (isInitializing: boolean, isInitialized: boolean, error: string | null = null) => {
            setCaptureState(prev => ({
                ...prev,
                isInitializing,
                isInitialized,
                error
            }));
        };

        const clearError = () => {
            setCaptureState(prev => ({ ...prev, error: null }));
        };

        // Mettre à jour l'état avec les méthodes
        setCaptureState(prev => ({
            ...prev,
            setInitializationState,
            clearError
        }));

        // Nettoyer tous les écouteurs lors du démontage
        return () => {
            subscription.remove();
        };
    }, []);


    return {...captureState, viewReady, setOnViewReady};
}