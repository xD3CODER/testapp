import {
    createCaptureSession,
    attachSessionToView,
    startCapture,
    finishCapture,
    cancelCapture,
    detectObject,
    resetDetection,
    navigateToReconstruction
} from '@/modules/expo-object-capture';

/**
 * Actions pour interagir avec le module de capture d'objet 3D
 * Ces fonctions sont indépendantes du hook d'état
 */
export const objectCaptureActions = {
    /**
     * Initialise une nouvelle session de capture
     * @returns Promise<boolean> - Succès de l'initialisation
     */
    initialize: async (): Promise<boolean> => {
        try {
            // Créer la session
            const sessionCreated = await createCaptureSession();
            if (!sessionCreated) {
                throw new Error("Impossible de créer la session de capture");
            }

            // Attacher la session à la vue avec un léger délai
            return await new Promise<boolean>((resolve) => {
                setTimeout(async () => {
                    try {
                        const result = await attachSessionToView();
                        resolve(result);
                    } catch (error) {
                        console.error("Erreur lors de l'attachement de la session:", error);
                        resolve(false);
                    }
                }, 250);
            });
        } catch (error) {
            console.error("Erreur lors de l'initialisation:", error);
            return false;
        }
    },

    /**
     * Démarre la détection d'un objet
     * @returns Promise<boolean> - Succès de la détection
     */
    detectObject: async (): Promise<boolean> => {
        try {
            return await detectObject();
        } catch (error) {
            console.error("Erreur lors de la détection:", error);
            return false;
        }
    },

    /**
     * Réinitialise la détection
     * @returns Promise<boolean> - Succès de la réinitialisation
     */
    resetDetection: async (): Promise<boolean> => {
        try {
            return await resetDetection();
        } catch (error) {
            console.error("Erreur lors de la réinitialisation:", error);
            return false;
        }
    },

    /**
     * Démarre la capture
     * @returns Promise<void>
     */
    startCapture: async (): Promise<void> => {
        try {
            await startCapture();
        } catch (error) {
            console.error("Erreur lors du démarrage de la capture:", error);
        }
    },

    /**
     * Termine la capture
     * @returns Promise<boolean> - Succès de la finalisation
     */
    finishCapture: async (): Promise<boolean> => {
        try {
            return await finishCapture();
        } catch (error) {
            console.error("Erreur lors de la finalisation:", error);
            return false;
        }
    },

    /**
     * Annule la capture
     * @returns Promise<boolean> - Succès de l'annulation
     */
    cancelCapture: async (): Promise<boolean> => {
        try {
            return await cancelCapture();
        } catch (error) {
            console.error("Erreur lors de l'annulation:", error);
            return false;
        }
    },

    /**
     * Navigation vers la vue de reconstruction
     * @returns Promise<boolean> - Succès de la navigation
     */
    navigateToReconstruction: async (): Promise<boolean> => {
        try {
            return await navigateToReconstruction();
        } catch (error) {
            console.error("Erreur lors de la navigation:", error);
            return false;
        }
    }
};