import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AnimatedFeedback from "@/components/AnimatedFeedback";
import { useShakeAnimation } from "@/components/useShakeAnimation";
import { useFadeAnimation } from "@/components/useFadeAnimation";
import {
  ObjectCaptureView,
  CaptureModeType,
  CaptureState,
  attachSessionToView,
  detectObject,
  resetDetection,
  startCapture,
  finishCapture,
  getModelPath,
  cancelCapture,
  navigateToReconstruction,
    createCaptureSession,
} from '@/modules/expo-object-capture';

import {useObjectCaptureState} from "@/hooks/useObjectCapture"

import Animated from "react-native-reanimated";
import { AnimatedCounter } from "@/components/ImagesCounter";

// Composant de chargement
const LoadingScreen = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#2196F3" />
      <Text style={styles.loadingText}>Initialisation de la caméra...</Text>
    </View>
);

export default function ScanScreen() {
  const router = useRouter();
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // Utiliser le hook pour gérer l'état de la capture
  const {
    state,
    cameraTracking,
    imageCount,
    feedbackMessages,
    isInitialized,
    isInitializing,
    error,
    scanPassComplete,
    setInitializationState,
      reconstructionProgress,
    clearError,
    viewReady,
      setOnViewReady
  } = useObjectCaptureState();


  // Animation de secousse pour la détection d'objet
  const { shake, animatedStyle } = useShakeAnimation(15);

  // Fonction pour ajouter des logs de débogage
  const addLog = useCallback((message: string) => {
    console.log(message); // Toujours afficher dans la console
    setDebugLog(prev => [message, ...prev.slice(0, 19)]);
  }, []);

  // Initialisation de la session de capture
  useEffect(() => {
    const initSession = async () => {
      if (!viewReady) return; // Attendre que la vue soit prête

      setInitializationState(true, false);

      try {
        // Étape 1: Créer la session
        const sessionCreated = await createCaptureSession();
        if (!sessionCreated) throw new Error("Impossible de créer la session");
        // Étape 2: Attacher la session à la vue
        const sessionAttached = await attachSessionToView();
        if (!sessionAttached) throw new Error("Impossible d'attacher la session");
        setTimeout(() =>     setInitializationState(false, true), 250);
      } catch (error) {
        console.error("Erreur d'initialisation:", error);
        setInitializationState(false, false, String(error));
      }
    };

    if (viewReady) {
      initSession();
    }
  }, [viewReady]);

  // Surveiller les erreurs et les afficher
  useEffect(() => {
    if (error) {
      addLog(`Erreur détectée: ${error}`);
      Alert.alert("Erreur", error, [
        { text: "OK", onPress: clearError }
      ]);
    }
  }, [error, clearError]);


  // Gérer la complétion de la reconstruction
  useEffect(() => {
    if (state === CaptureState.RECONSTRUCTING) {
      addLog("État de reconstruction détecté, navigation en cours...");
      navigateToReconstruction().catch(err => {
        addLog(`Erreur de navigation: ${err}`);
      }).then((e) => console.log("Successfully display reconstruction screen ? ", e));
    }
    if(state === CaptureState.DONE) {
      getModelPath().then((modelPath) => {
        console.log("Model path: ", modelPath);
      })
    }
  }, [state]);

  // Gérer la détection d'objet
  const handleDetectObject = useCallback(async () => {
    try {
      addLog("Démarrage de la détection d'objet...");
      const success = await detectObject();
      if (!success) {
        shake();
      }
      addLog(`Résultat de la détection: ${success ? "Réussi" : "Échec"}`);
    } catch (error) {
      addLog(`Erreur de détection: ${error}`);
      Alert.alert("Erreur", `Une erreur est survenue lors de la détection: ${error}`);
    }
  }, [addLog, detectObject, shake]);

  // Gérer l'annulation de la détection
  const handleCancelDetection = useCallback(async () => {
    try {
      addLog("Annulation de la détection...");
      const success = await resetDetection();
      addLog(`resetDetection résultat: ${success}`);
    } catch (error) {
      addLog(`Erreur d'annulation: ${error}`);
      Alert.alert('Erreur', `Une erreur est survenue lors de l'annulation de la détection: ${error}`);
    }
  }, [addLog, resetDetection]);

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
  }, [addLog, finishCapture]);

  // Gérer l'annulation
  const handleCancel = useCallback(() => {
    cancelCapture().catch(err => {
      console.error("Erreur lors de l'annulation de la capture:", err);
    });
    router.back();
  }, [router, cancelCapture]);

  // Afficher/masquer le débogage
  const handleToggleDebug = useCallback(() => {
    getModelPath().then((modelPath) => {
      console.log("Model path: ", modelPath);
    })
  }, []);

  // Animation de fondu basée sur l'état du tracking caméra
  const fadeStyle = useFadeAnimation(cameraTracking === "normal", {
    duration: 400,
    targetOpacity: 0.9
  });

  const CaptureView = useMemo(() => {
    return(
        <ObjectCaptureView
            style={styles.captureView}
            captureMode={CaptureModeType.OBJECT}
            onViewReady={(event) => {
              setOnViewReady(true);
            }}
        />
    )
  }, [setOnViewReady])


  return (
      <View style={styles.container}>
        {(isInitializing || !isInitialized) && <LoadingScreen />}
        <SafeAreaView style={styles.container}>

          <View style={styles.captureViewContainer}>
            {CaptureView}
          </View>

          <View style={{position: 'absolute', zIndex: 222222}}>
            <TouchableOpacity
                onPress={() => router.navigate("scanPasses")}>
              <Text style={styles.buttonText}>BACK</Text>
            </TouchableOpacity>
          </View>

          {/* Bouton de débogage en haut à droite */}
          <TouchableOpacity
              style={styles.debugButton}
              onPress={handleToggleDebug}>
            <Text style={styles.debugButtonText}>Debug</Text>
          </TouchableOpacity>

          {/* Messages de feedback */}
          <View style={styles.feedbackContainer}>
            <AnimatedFeedback messages={feedbackMessages} />
          </View>

          {/* Zone de débogage */}
          {showDebug && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>État actuel: {state}</Text>
                <View style={styles.debugScroll}>
                  {debugLog.map((log, index) => (
                      <Text key={index} style={styles.debugText}>{log}</Text>
                  ))}
                </View>
                <TouchableOpacity
                    style={styles.testButton}
                    onPress={navigateToReconstruction}>
                  <Text style={styles.buttonText}>Tester les événements</Text>
                </TouchableOpacity>
              </View>
          )}

          {/* Contrôles de capture */}
          <Animated.View style={[styles.controlsContainer, fadeStyle]}>
            <>
              {state === CaptureState.READY && (
                  <Animated.View style={[animatedStyle]}>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleDetectObject}>
                      <Text style={styles.buttonText}>Détecter l'objet</Text>
                    </TouchableOpacity>
                  </Animated.View>
              )}

              {state === CaptureState.DETECTING && (
                  <View>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={startCapture}>
                      <Text style={styles.buttonText}>Démarrer la capture</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancelDetection}>
                      <Text style={styles.buttonText}>Annuler</Text>
                    </TouchableOpacity>
                  </View>
              )}

              {state === CaptureState.CAPTURING && (
                  <View style={{flexDirection: "column", flex: 1, width: "100%"}}>
                    <View style={{flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center"}}>
                      <TouchableOpacity
                          style={styles.button}
                          onPress={handleFinishCapture}>
                        <Text style={styles.buttonText}>Terminer</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{flex: 1, flexDirection: "row", paddingHorizontal: 10}}>
                      <View style={{backgroundColor: "#00000044", borderRadius: 400}}>
                        <AnimatedCounter current={imageCount} size={12}/>
                      </View>
                    </View>
                  </View>
              )}
            </>
          </Animated.View>
        </SafeAreaView>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
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
    alignItems: 'center'
  },
  feedbackText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 5,
  },
  imageCounter: {
    backgroundColor: "#00000044",
    borderRadius: 400,
    padding: 5,
    color: 'white',
    fontSize: 16,
    marginBottom: 5,
  },
  controlsContainer: {
    position: 'absolute',
    flex: 1,
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderRadius: 10,
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
    position: 'absolute',
    zIndex: 999,
    top:0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000'
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    marginTop: 20,
    textAlign: 'center'
  }
});