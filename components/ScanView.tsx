import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, Platform } from 'react-native';
import ExpoObjectCaptureModule, {
  ObjectCaptureView,
  CaptureModeType,
  createCaptureSession,
  attachSessionToView,
  startCapture,
  finishCapture,
  cancelCapture
} from '../modules/expo-object-capture';

interface ScanScreenProps {
  onComplete: (modelPath: string, previewPath: string) => void;
  onCancel: () => void;
}

const ScanScreen: React.FC<ScanScreenProps> = ({ onComplete, onCancel }) => {
  // États
  const [state, setState] = useState('ready');
  const [feedbackMessages, setFeedbackMessages] = useState<string[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [sessionInitializing, setSessionInitializing] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  // Fonction pour ajouter des logs de débogage
  const addLog = (message: string) => {
    console.log(message);
    setDebugLog(prev => [message, ...prev.slice(0, 9)]);
  };

  // Initialiser les listeners lors du montage du composant
  useEffect(() => {
    addLog("Composant monté - initialisation des listeners");

    // Configurer les listeners pour les événements
    const stateListener = ExpoObjectCaptureModule.addStateChangeListener(event => {
      addLog(`Changement d'état: ${event.state}`);
      setState(event.state);
    });

    const feedbackListener = ExpoObjectCaptureModule.addFeedbackListener(event => {
      addLog(`Feedback reçu: ${event.messages.join(', ')}`);
      setFeedbackMessages(event.messages);
    });

    const modelCompleteListener = ExpoObjectCaptureModule.addModelCompleteListener(event => {
      addLog(`Modèle terminé: ${event.modelPath}`);
      onComplete(event.modelPath, event.previewPath);
    });

    const errorListener = ExpoObjectCaptureModule.addErrorListener(event => {
      addLog(`Erreur: ${event.message}`);
      Alert.alert("Erreur", event.message);
    });

    // Nettoyer les ressources
    return () => {
      addLog("Démontage du composant - nettoyage des listeners");
      stateListener?.remove();
      feedbackListener?.remove();
      modelCompleteListener?.remove();
      errorListener?.remove();
      // Annuler la capture en cours si nécessaire
      cancelCapture().catch(err => {
        console.error("Erreur lors de l'annulation de la capture:", err);
      });
    };
  }, []);

  // Fonction pour lancer une capture modale
  const handleStartModalCapture = useCallback(async () => {
    try {
      addLog("Démarrage de la capture modale...");
      setIsCapturing(true);

      // Vérifier si iOS 18 est disponible
      if (Platform.OS === 'ios' && parseInt(Platform.Version as string, 10) < 18) {
        Alert.alert("Non supporté", "La capture 3D nécessite iOS 18 ou supérieur");
        setIsCapturing(false);
        return;
      }

      // Vérifier si la capture est supportée
      addLog(`Vérification du support: ${ExpoObjectCaptureModule.isSupported()}`);

      if (!ExpoObjectCaptureModule.isSupported()) {
        Alert.alert("Non supporté", "La capture d'objets 3D n'est pas supportée sur cet appareil");
        setIsCapturing(false);
        return;
      }

      // Utiliser la nouvelle API de capture modale
      addLog("Appel de la méthode startCapture");
      const result = await startCapture({
        captureMode: CaptureModeType.OBJECT
      });

      addLog(`Résultat de la capture: ${JSON.stringify(result)}`);

      if (result && result.success && result.modelUrl) {
        // Extraction du chemin et du prévisualisation à partir des résultats
        const modelPath = result.modelUrl;
        // Dans le cas où previewPath n'est pas fourni, nous utilisons le même modelUrl
        const previewPath = result.previewUrl || result.modelUrl;

        onComplete(modelPath, previewPath);
      } else {
        setState('ready');
      }
    } catch (error) {
      addLog(`Erreur lors de la capture: ${error}`);
      Alert.alert(
        'Erreur de capture',
        `Une erreur est survenue lors de la capture 3D: ${error}`
      );
      setState('ready');
    } finally {
      setIsCapturing(false);
    }
  }, [onComplete]);

  // Fonction pour initialiser la vue intégrée
  const handleStartEmbeddedCapture = useCallback(async () => {
    if (!sessionInitialized && !sessionInitializing) {
      addLog("Initialisation de la session intégrée...");
      setSessionInitializing(true);

      try {
        // Créer une nouvelle session de capture
        addLog("Appel de createCaptureSession");
        const success = await createCaptureSession();
        addLog(`createCaptureSession résultat: ${success}`);

        if (!success) {
          Alert.alert("Erreur", "Impossible de créer une session de capture");
          setSessionInitializing(false);
          return false;
        }

        // Attacher la session à la vue
        addLog("Appel de attachSessionToView");
        const attachSuccess = await attachSessionToView();
        addLog(`attachSessionToView résultat: ${attachSuccess}`);

        if (!attachSuccess) {
          Alert.alert("Erreur", "Impossible d'attacher la session à la vue");
          setSessionInitializing(false);
          return false;
        }

        setSessionInitialized(true);
        setSessionInitializing(false);
        return true;
      } catch (error) {
        addLog(`Erreur d'initialisation: ${error}`);
        Alert.alert("Erreur", `Une erreur est survenue lors de l'initialisation de la capture: ${error}`);
        setSessionInitializing(false);
        return false;
      }
    } else {
      Alert.alert("Info", "La session est déjà initialisée ou en cours d'initialisation.");
      return sessionInitialized;
    }
  }, [sessionInitialized, sessionInitializing]);

  // Fonction pour terminer la capture
  const handleFinishCapture = useCallback(async () => {
    try {
      addLog("Terminer la capture...");
      setState('prepareToReconstruct');
      const success = await finishCapture();
      addLog(`finishCapture résultat: ${success}`);

      if (!success) {
        Alert.alert("Erreur", "Impossible de terminer la capture");
      }
    } catch (error) {
      addLog(`Erreur de finalisation: ${error}`);
      Alert.alert(
        'Erreur',
        `Une erreur est survenue lors de la finalisation de la capture: ${error}`
      );
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

  // Rendu des contrôles en fonction de l'état
  const renderControls = () => {
    if (sessionInitializing) {
      return (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>Initialisation de la capture...</Text>
        </View>
      );
    }

    if (isCapturing) {
      return (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>Capture en cours...</Text>
        </View>
      );
    }

    switch (state) {
      case 'ready':
        return (
          <>
            <TouchableOpacity
              style={styles.button}
              onPress={handleStartModalCapture}>
              <Text style={styles.buttonText}>Démarrer la capture (Modal)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#4CAF50' }]}
              onPress={handleStartEmbeddedCapture}>
              <Text style={styles.buttonText}>Initialiser la vue intégrée</Text>
            </TouchableOpacity>
          </>
        );

      case 'detecting':
        return (
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setState('capturing');
            }}>
            <Text style={styles.buttonText}>Commencer à capturer</Text>
          </TouchableOpacity>
        );

      case 'capturing':
        return (
          <>
            <Text style={styles.imageCountText}>Images: {imageCount}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={handleFinishCapture}>
              <Text style={styles.buttonText}>Terminer la capture</Text>
            </TouchableOpacity>
          </>
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
        {renderControls()}

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
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
  cancelButton: {
    backgroundColor: '#F44336',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    width: 250,
    alignItems: 'center',
    marginTop: 10,
  },
  progressContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
    width: 300,
  },
  progressText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  imageCountText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
  }
});

export default ScanScreen;