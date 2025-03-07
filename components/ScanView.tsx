import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
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

  // Référence à la vue de capture
  const viewRef = useRef(null);

  // Initialiser la session de capture
  const initializeCaptureSession = useCallback(async () => {
    try {
      console.log("Initialisation de la session de capture...");
      setSessionInitializing(true);

      // Créer une nouvelle session de capture
      const success = await createCaptureSession();
      console.log("Session créée:", success);

      if (!success) {
        console.error("Échec de la création de la session de capture");
        Alert.alert("Erreur", "Impossible de créer une session de capture");
        setSessionInitializing(false);
        return false;
      }

      // Attacher la session à la vue
      const attachSuccess = await attachSessionToView();
      console.log("Session attachée:", attachSuccess);

      if (!attachSuccess) {
        console.error("Échec de l'attachement de la session à la vue");
        Alert.alert("Erreur", "Impossible d'attacher la session à la vue");
        setSessionInitializing(false);
        return false;
      }

      setSessionInitialized(true);
      setSessionInitializing(false);
      return true;
    } catch (error) {
      console.error("Erreur lors de l'initialisation de la session:", error);
      Alert.alert("Erreur", "Une erreur est survenue lors de l'initialisation de la capture");
      setSessionInitializing(false);
      return false;
    }
  }, []);

  // Fonction pour lancer une capture modale
  const handleStartModalCapture = useCallback(async () => {
    try {
      setIsCapturing(true);

      // Utiliser la nouvelle API de capture modale
      const result = await startCapture({
        captureMode: CaptureModeType.OBJECT
      });

      console.log("Résultat de la capture:", result);

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
      console.error('Erreur lors de la capture:', error);
      Alert.alert(
        'Erreur de capture',
        'Une erreur est survenue lors de la capture 3D.'
      );
      setState('ready');
    } finally {
      setIsCapturing(false);
    }
  }, [onComplete]);

  // Fonction pour initialiser la vue intégrée
  const handleStartEmbeddedCapture = useCallback(async () => {
    if (!sessionInitialized && !sessionInitializing) {
      await initializeCaptureSession();
    } else {
      Alert.alert("Info", "La session est déjà initialisée ou en cours d'initialisation.");
    }
  }, [sessionInitialized, sessionInitializing, initializeCaptureSession]);

  // Fonction pour terminer la capture
  const handleFinishCapture = useCallback(async () => {
    try {
      setState('prepareToReconstruct');
      const success = await finishCapture();
      console.log("Capture terminée:", success);

      if (!success) {
        Alert.alert("Erreur", "Impossible de terminer la capture");
      }
    } catch (error) {
      console.error('Erreur lors de la fin de la capture:', error);
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la finalisation de la capture.'
      );
    }
  }, []);

  // Initialiser la session quand le composant est monté
  useEffect(() => {
    // Mise à jour régulière du nombre d'images
    const imageCountInterval = setInterval(() => {
      if (state === 'capturing' && sessionInitialized) {
        try {
          const count = ExpoObjectCaptureModule.getImageCount();
          setImageCount(count);
        } catch (e) {
          console.error("Erreur lors de la récupération du nombre d'images:", e);
        }
      }
    }, 1000);

    // Configurer les listeners pour les événements
    const stateListener = ExpoObjectCaptureModule.addStateChangeListener(event => {
      console.log("Changement d'état:", event.state);
      setState(event.state);
    });

    const feedbackListener = ExpoObjectCaptureModule.addFeedbackListener(event => {
      console.log("Feedback reçu:", event.messages);
      setFeedbackMessages(event.messages);
    });

    // Nettoyer les ressources
    return () => {
      clearInterval(imageCountInterval);
      stateListener?.remove();
      feedbackListener?.remove();
      // Annuler la capture en cours si nécessaire
      cancelCapture().catch(err => {
        console.error("Erreur lors de l'annulation de la capture:", err);
      });
    };
  }, [state, sessionInitialized]);

  // Gestionnaire d'événement quand la vue est prête
  const handleViewReady = useCallback(() => {
    console.log("Vue de capture prête");
  }, []);

  // Gérer l'annulation
  const handleCancel = useCallback(async () => {
    try {
      const success = await cancelCapture();
      console.log("Capture annulée:", success);
      onCancel();
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la capture:', error);
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

      case 'prepareToReconstruct':
        return (
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setState('reconstructing');
            }}>
            <Text style={styles.buttonText}>Créer le modèle 3D</Text>
          </TouchableOpacity>
        );

      case 'reconstructing':
        return (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Reconstruction en cours...
            </Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: '50%' }]} />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Vue de capture */}
      <ObjectCaptureView
        ref={viewRef}
        style={styles.captureView}
        captureMode={CaptureModeType.OBJECT}
        onViewReady={handleViewReady}
      />

      {/* Messages de feedback */}
      <View style={styles.feedbackContainer}>
        {feedbackMessages.map((message, index) => (
          <Text key={index} style={styles.feedbackText}>{message}</Text>
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
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
  },
  imageCountText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
  }
});

export default ScanScreen;