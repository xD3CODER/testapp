import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, Platform } from 'react-native';
import ExpoObjectCaptureModule, {
  ObjectCaptureView,
  CaptureModeType,
  createCaptureSession,
  attachSessionToView,
  startCapture,
  finishCapture,
  cancelCapture,
  detectObject,
  resetDetection,
} from '@/modules/expo-object-capture';

interface ScanScreenProps {
  onComplete: (modelPath: string, previewPath: string) => void;
  onCancel: () => void;
}

const ScanScreen: React.FC<ScanScreenProps> = ({ onComplete, onCancel }) => {
  // États
  const [state, setState] = useState('initializing');
  const [feedbackMessages, setFeedbackMessages] = useState<string[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<string | undefined>(undefined);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  // Fonction pour ajouter des logs de débogage
  const addLog = (message: string) => {
    console.log(message);
    setDebugLog(prev => [message, ...prev.slice(0, 9)]);
  };

  // Initialisation de la session de capture
  const initializeCapture = useCallback(async () => {
    try {
      addLog("Initialisation de la session de capture...");

      // Vérifier si iOS 18 est disponible
      if (Platform.OS === 'ios' && parseInt(Platform.Version as string, 10) < 18) {
        Alert.alert("Non supporté", "La capture 3D nécessite iOS 18 ou supérieur");
        onCancel();
        return;
      }

      // Vérifier si la capture est supportée
      if (!ExpoObjectCaptureModule.isSupported()) {
        Alert.alert("Non supporté", "La capture d'objets 3D n'est pas supportée sur cet appareil");
        onCancel();
        return;
      }

      // Créer la session
      const sessionCreated = await createCaptureSession();
      if (!sessionCreated) {
        throw new Error("Impossible de créer la session de capture");
      }

      // Attacher la session à la vue
      const sessionAttached = await attachSessionToView();
      if (!sessionAttached) {
        throw new Error("Impossible d'attacher la session à la vue");
      }

      setState('ready');
      addLog("Session de capture initialisée avec succès");
    } catch (error) {
      addLog(`Erreur d'initialisation: ${error}`);
      Alert.alert("Erreur", `Impossible d'initialiser la capture: ${error}`);
      onCancel();
    }
  }, [onCancel]);

  // Initialiser les listeners et la capture
  useEffect(() => {
    // Configurer les listeners pour les événements
    const stateListener = ExpoObjectCaptureModule.addStateChangeListener(event => {
      addLog(`Changement d'état: ${event.state}`);
      setState(event.state);

      // Mettre à jour le compteur d'images automatiquement lors de la capture
      if (event.state === 'capturing') {
        ExpoObjectCaptureModule.getImageCountAsync().then(count => {
          setImageCount(count);
        });
      }
    });

    const feedbackListener = ExpoObjectCaptureModule.addFeedbackListener(event => {
      addLog(`Feedback reçu: ${event.messages.join(', ')}`);
      setFeedbackMessages(event.messages);
    });

    const progressListener = ExpoObjectCaptureModule.addProgressListener(event => {
      addLog(`Progression: ${event.progress.toFixed(2)}${event.stage ? ' - ' + event.stage : ''}`);
      setProgress(event.progress);
      setProcessingStage(event.stage);
    });

    const modelCompleteListener = ExpoObjectCaptureModule.addModelCompleteListener(event => {
      addLog(`Modèle terminé: ${event.modelPath}`);
      onComplete(event.modelPath, event.previewPath);
    });

    const errorListener = ExpoObjectCaptureModule.addErrorListener(event => {
      addLog(`Erreur: ${event.message}`);
      Alert.alert("Erreur", event.message);
    });

    // Initialiser la capture dès le montage
    initializeCapture();

    // Nettoyer les ressources
    return () => {
      addLog("Démontage du composant - nettoyage des listeners");
      stateListener?.remove();
      feedbackListener?.remove();
      progressListener?.remove();
      modelCompleteListener?.remove();
      errorListener?.remove();

      // Annuler la capture si elle est en cours
      cancelCapture().catch(err => {
        console.error("Erreur lors de l'annulation de la capture:", err);
      });
    };
  }, [initializeCapture, onComplete, onCancel]);

  // Lancer la détection d'objet
  const handleDetectObject = useCallback(async () => {
    try {
      addLog("Démarrage de la détection d'objet...");
      const success = await detectObject();
      addLog(`Résultat de la détection: ${success ? "Réussi" : "Échec"}`);
    } catch (error) {
      addLog(`Erreur de détection: ${error}`);
      Alert.alert("Erreur", `Une erreur est survenue lors de la détection: ${error}`);
    }
  }, []);

  // Réinitialiser la détection
  const handleResetDetection = useCallback(async () => {
    try {
      addLog("Réinitialisation de la détection...");
      await resetDetection();
    } catch (error) {
      addLog(`Erreur de réinitialisation: ${error}`);
      Alert.alert("Erreur", `Une erreur est survenue lors de la réinitialisation: ${error}`);
    }
  }, []);

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
  }, []);

  // Gérer l'annulation
  const handleCancel = useCallback(async () => {
    try {
      addLog("Annulation de la capture...");
      const success = await cancelCapture();
      addLog(`cancelCapture résultat: ${success}`);
      onCancel();
    } catch (error) {
      addLog(`Erreur d'annulation: ${error}`);
      onCancel();
    }
  }, [onCancel]);

  // Mise à jour périodique du compteur d'images
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (state === 'capturing') {
      interval = setInterval(() => {
        ExpoObjectCaptureModule.getImageCountAsync().then(count => {
          setImageCount(count);
        });
      }, 1000); // Toutes les secondes
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state]);

  // Affichage conditionnel en fonction de l'état
  const renderContent = () => {
    switch (state) {
      case 'initializing':
        return (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>Initialisation de la capture...</Text>
          </View>
        );

      case 'ready':
        return (
          <TouchableOpacity
            style={styles.button}
            onPress={handleDetectObject}>
            <Text style={styles.buttonText}>Détecter l'objet</Text>
          </TouchableOpacity>
        );

      case 'detecting':
        return (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleResetDetection}>
              <Text style={styles.buttonText}>Réinitialiser</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#4CAF50' }]}
              onPress={handleDetectObject}>
              <Text style={styles.buttonText}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        );

      case 'capturing':
        return (
          <View style={styles.captureContainer}>
            <Text style={styles.imageCountText}>Images capturées: {imageCount}</Text>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#4CAF50' }]}
              onPress={handleFinishCapture}>
              <Text style={styles.buttonText}>Terminer la capture</Text>
            </TouchableOpacity>
          </View>
        );

      case 'finishing':
      case 'reconstructing':
        return (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {processingStage || "Traitement en cours..."}
            </Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${Math.max(5, Math.min(100, progress * 100))}%` }
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          </View>
        );

      default:
        return (
          <Text style={styles.statusText}>
            État actuel: {state}
          </Text>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Vue de capture */}
      <ObjectCaptureView
        style={styles.captureView}
        captureMode={CaptureModeType.OBJECT}
      />

      {/* Messages de feedback */}
      <View style={styles.feedbackContainer}>
        {feedbackMessages.map((message, index) => (
          <Text key={index} style={styles.feedbackText}>{message}</Text>
        ))}
      </View>

      {/* Logs de débogage */}
      <View style={styles.debugContainer}>
        <Text style={styles.debugTitle}>Logs de débogage:</Text>
        {debugLog.map((log, index) => (
          <Text key={index} style={styles.debugText}>{log}</Text>
        ))}
      </View>

      {/* Contrôles */}
      <View style={styles.controlsContainer}>
        {renderContent()}

        {/* Bouton d'annulation toujours présent */}
        {['initializing', 'finishing', 'reconstructing'].includes(state) ? null : (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}>
            <Text style={styles.buttonText}>Annuler</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  captureView: {
    flex: 1,
  },
  feedbackContainer: {
    position: 'absolute',
    top: 100,
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
  debugContainer: {
    position: 'absolute',
    top: 170,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
    maxHeight: 200,
  },
  debugTitle: {
    color: 'yellow',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugText: {
    color: 'lime',
    fontSize: 10,
    marginBottom: 2,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    padding: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
  },
  captureContainer: {
    alignItems: 'center',
    width: '100%',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 150,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#F44336',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    width: 150,
    alignItems: 'center',
    marginTop: 10,
  },
  progressContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
    width: 300,
    alignItems: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 10,
    backgroundColor: '#444',
    borderRadius: 5,
    marginVertical: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  imageCountText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
  }
});

export default ScanScreen;