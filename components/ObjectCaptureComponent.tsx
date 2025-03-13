import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ScrollView, ActivityIndicator } from 'react-native';
import {
  ObjectCaptureView,
  CaptureModeType,
  eventEmitter,
  createCaptureSession,
  attachSessionToView,
  finishCapture,
  cancelCapture,
  detectObject,
  resetDetection,
  getImageCount
} from '@/modules/expo-object-capture';

interface ObjectCaptureComponentProps {
  onComplete: (modelPath: string, previewPath: string) => void;
  onCancel: () => void;
}

const ObjectCaptureComponent: React.FC<ObjectCaptureComponentProps> = ({ onComplete, onCancel }) => {
  // États
  const [state, setState] = useState<string>('initializing');
  const [feedbackMessages, setFeedbackMessages] = useState<string[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Fonction pour ajouter des logs de débogage
  const addLog = useCallback((message: string) => {
    console.log(message); // Toujours afficher dans la console
    setDebugLog(prev => [message, ...prev.slice(0, 19)]);
  }, []);

  // Initialisation de la session de capture
  const initializeCapture = useCallback(async () => {
    try {
      setIsInitializing(true);
      addLog("Initialisation de la session de capture...");

      // Créer la session
      const sessionCreated = await createCaptureSession();
      addLog(`Session créée: ${sessionCreated}`);

      if (!sessionCreated) {
        throw new Error("Impossible de créer la session de capture");
      }

      // Attacher la session à la vue
      const sessionAttached = await attachSessionToView();
      addLog(`Session attachée: ${sessionAttached}`);

      if (!sessionAttached) {
        throw new Error("Impossible d'attacher la session à la vue");
      }

      // La session est prête
      setState('ready');
      addLog("Session de capture initialisée avec succès");
      setIsInitializing(false);

    } catch (error) {
      addLog(`Erreur d'initialisation: ${error}`);
      Alert.alert("Erreur", `Impossible d'initialiser la capture: ${error}`);
      onCancel();
    }
  }, [onCancel, addLog]);

  // Gérer la détection d'objet
  const handleDetectObject = useCallback(async () => {
    try {
      addLog("Démarrage de la détection d'objet...");
      const success = await detectObject();
      addLog(`Résultat de la détection: ${success ? "Réussi" : "Échec"}`);
    } catch (error) {
      addLog(`Erreur de détection: ${error}`);
      Alert.alert("Erreur", `Une erreur est survenue lors de la détection: ${error}`);
    }
  }, [addLog]);

  // Terminer la capture
  const handleFinishCapture = useCallback(async () => {
    try {
      addLog("Terminer la capture...");
      const success = await finishCapture();
      addLog(`finishCapture résultat: ${success}`);

      if (!success) {
        Alert.alert("Erreur", "Impossible de terminer la capture");
      }
    } catch (error) {
      addLog(`Erreur de finalisation: ${error}`);
      Alert.alert('Erreur', `Une erreur est survenue lors de la finalisation de la capture: ${error}`);
    }
  }, [addLog]);

  // Afficher/masquer le débogage
  const handleToggleDebug = useCallback(() => {
    setShowDebug(prev => !prev);
  }, []);

  // Tester l'envoi d'événements
  const testEvents = useCallback(async () => {
    try {
      addLog("Simulation locale d'un événement de feedback");
      // Simuler un événement localement
      setFeedbackMessages(["Message de test local: " + new Date().toISOString()]);
    } catch (error) {
      addLog(`Erreur de test d'événement: ${error}`);
    }
  }, [addLog]);

  // Configuration des écouteurs et initialisation
  useEffect(() => {
    addLog("Composant monté - configuration des écouteurs...");

    // Configurer les écouteurs d'événements
    const stateListener = eventEmitter.addListener('onStateChanged', (event) => {
      addLog(`État changé: ${event.state}`);
      setState(event.state);

      // Mettre à jour le compte d'images si on est en mode capture
      if (event.state === 'capturing') {
        setImageCount(getImageCount());
      }

      // Marquer comme non initialisé si l'état n'est plus initializing
      if (event.state !== 'initializing') {
        setIsInitializing(false);
      }
    });

    const feedbackListener = eventEmitter.addListener('onFeedbackChanged', (event) => {
      addLog(`Feedback reçu: ${event.messages?.join(', ') || 'aucun message'}`);
      setFeedbackMessages(event.messages || []);
    });

    const modelCompleteListener = eventEmitter.addListener('onModelComplete', (event) => {
      addLog(`Modèle terminé: ${event.modelPath}`);
      onComplete(event.modelPath, event.previewPath);
    });

    const errorListener = eventEmitter.addListener('onError', (event) => {
      addLog(`Erreur: ${event.message}`);
      Alert.alert("Erreur", event.message);
    });

    // Initialiser la capture après la configuration des écouteurs
    initializeCapture();

    // Nettoyage à la destruction du composant
    return () => {
      addLog("Démontage du composant - nettoyage des écouteurs");
      stateListener.remove();
      feedbackListener.remove();
      modelCompleteListener.remove();
      errorListener.remove();

      // Annuler la capture si nécessaire
      cancelCapture().catch(err => {
        console.error("Erreur lors de l'annulation de la capture:", err);
      });
    };
  }, [initializeCapture, onComplete, onCancel, addLog]);

  // Si le composant est en cours d'initialisation, afficher un loader
  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Initialisation de la capture...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.captureViewContainer}>
        <ObjectCaptureView
          style={styles.captureView}
          captureMode={CaptureModeType.OBJECT}
        />
      </View>

      {/* Bouton de débogage en haut à droite */}
      <TouchableOpacity
        style={styles.debugButton}
        onPress={handleToggleDebug}>
        <Text style={styles.debugButtonText}>Debug</Text>
      </TouchableOpacity>

      {/* Messages de feedback */}
      <View style={styles.feedbackContainer}>
        {feedbackMessages.map((message, index) => (
          <Text key={index} style={styles.feedbackText}>{message}</Text>
        ))}
      </View>

      {/* Zone de débogage */}
      {showDebug && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>État actuel: {state}</Text>
          <Text style={styles.debugTitle}>Images: {imageCount}</Text>
          <ScrollView style={styles.debugScroll}>
            {debugLog.map((log, index) => (
              <Text key={index} style={styles.debugText}>{log}</Text>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.testButton}
            onPress={testEvents}>
            <Text style={styles.buttonText}>Tester les événements</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contrôles de capture */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleDetectObject}>
          <Text style={styles.buttonText}>Détecter l'objet</Text>
        </TouchableOpacity>

        {state === 'capturing' && (
          <TouchableOpacity
            style={styles.finishButton}
            onPress={handleFinishCapture}>
            <Text style={styles.buttonText}>Terminer la capture</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  captureViewContainer: {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    position: "absolute",
    zIndex: 0,
  },
  captureView: {
    flex: 1,
  },
  feedbackContainer: {
    position: 'absolute',
    top: 150,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
  },
  feedbackText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 5,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    padding: 20,
    zIndex: 10,
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    width: 250,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  finishButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    width: 250,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  cancelButton: {
    backgroundColor: '#F44336',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    width: 250,
    alignItems: 'center',
    marginTop: 10,
  },
  debugButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
    zIndex: 20,
  },
  debugButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  debugContainer: {
    position: 'absolute',
    top: 100,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 10,
    padding: 10,
    maxHeight: 300,
    zIndex: 15,
  },
  debugTitle: {
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugScroll: {
    maxHeight: 200,
  },
  debugText: {
    color: '#aaffaa',
    fontSize: 12,
    marginBottom: 2,
  },
  testButton: {
    backgroundColor: '#9C27B0',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    marginTop: 20,
    textAlign: 'center'
  }
});

export default ObjectCaptureComponent;