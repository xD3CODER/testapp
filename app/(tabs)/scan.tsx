import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import ExpoObjectCaptureModule, {
  ObjectCaptureView,
  CaptureModeType,
  createCaptureSession,
  attachSessionToView,
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
  const [state, setState] = useState('initializing');
  const [feedbackMessages, setFeedbackMessages] = useState<string[]>([]);
  const [imageCount, setImageCount] = useState(0);
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

      // Démarrer la capture automatiquement
      setState('detecting');

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

      // Gérer automatiquement les transitions
      if (event.state === 'capturing') {
        setImageCount(ExpoObjectCaptureModule.getImageCount());
      }
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
      onCancel();
    });

    // Initialiser la capture dès le montage
    initializeCapture();
    // Nettoyer les ressources
    return () => {
      addLog("Démontage du composant - nettoyage des listeners");
      stateListener?.remove();
      feedbackListener?.remove();
      modelCompleteListener?.remove();
      errorListener?.remove();

      // Annuler la capture si elle est en cours
      cancelCapture().catch(err => {
        console.error("Erreur lors de l'annulation de la capture:", err);
      });
    };
  }, [initializeCapture, onComplete, onCancel]);

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
  // Affichage conditionnel en fonction de l'état
  const renderContent = () => {
    switch (state) {
      case 'initializing':
        return (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>Initialisation de la capture...</Text>
          </View>
        );

      case 'detecting':
        return (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>Détection de l'objet...</Text>
          </View>
        );

      case 'capturing':
        return (
          <View style={styles.feedbackContainer}>
            <Text style={styles.imageCountText}>Images capturées: {imageCount}</Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.captureViewContainer}>
      <ObjectCaptureView
              style={styles.captureView}
              captureMode={CaptureModeType.OBJECT}
            />
      </View>
      <View style={{flex: 1, flexDirection: "column", justifyContent: "space-between", marginHorizontal: 25}}>
       <View style={{flexDirection: "row", columnGap: 20, justifyContent: "space-between"}}>

        </View>
          <View style={{flexDirection: "row", justifyContent: "center"}}>
             <View style={{bottom: 60}}>

             </View>
             <View style={{bottom: 60}}>

             </View>
          </View>
      </View>

      {/* Messages de feedback */}
      <View style={styles.feedbackContainer}>
        {feedbackMessages.map((message, index) => (
          <Text key={index} style={styles.feedbackText}>{message}</Text>
        ))}
      </View>

      {/* Contenu dynamique */}
      <View style={styles.controlsContainer}>

        {renderContent()}

        {state === 'capturing' && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleFinishCapture}>
            <Text style={styles.buttonText}>Terminer la capture</Text>
          </TouchableOpacity>
        )}
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
    top: 250,
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