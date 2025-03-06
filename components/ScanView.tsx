// ScanView.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import type { ObjectDimensions } from '../modules/expo-mesh-scanner/src/ExpoMeshScannerModule';
import MeshScanner from '../modules/expo-mesh-scanner';
import { ExpoMeshScannerView } from '../modules/expo-mesh-scanner';

interface ScanViewProps {
  onScanComplete?: (modelPath: string, previewPath: string) => void;
  onClose?: () => void;
}

const ScanView: React.FC<ScanViewProps> = ({ onScanComplete, onClose }) => {
  // États
  const [deviceSupported, setDeviceSupported] = useState<boolean>(false);
  const [currentState, setCurrentState] = useState<string>('notStarted');
  const [feedbackMessages, setFeedbackMessages] = useState<string[]>([]);
  const [objectDimensions, setObjectDimensions] = useState<ObjectDimensions>({
    width: 0.2,
    height: 0.2,
    depth: 0.2,
  });
  const [reconstructing, setReconstructing] = useState<boolean>(false);
  const [reconstructionProgress, setReconstructionProgress] = useState<number>(0);
  const [reconstructionStage, setReconstructionStage] = useState<string>('');

  // Vérifier le support de l'appareil au montage
  useEffect(() => {
    const checkDeviceSupport = async () => {
      try {
        const supportInfo = await MeshScanner.checkSupport();
        setDeviceSupported(supportInfo.supported);

        if (!supportInfo.supported) {
          Alert.alert(
            'Device Not Supported',
            supportInfo.reason || 'Your device does not support 3D scanning',
            [{ text: 'OK', onPress: onClose }]
          );
        }
      } catch (error) {
        console.error('Error checking device support:', error);
        Alert.alert('Error', 'Failed to check device compatibility');
      }
    };

    checkDeviceSupport();

    // Nettoyer les anciens scans
    MeshScanner.cleanScanDirectories();
  }, [onClose]);

  // Configurer les écouteurs d'événements
  useEffect(() => {
    if (!deviceSupported) return;

    // Écouteur d'état
    const stateListener = MeshScanner.onScanStateChanged((event) => {
      setCurrentState(event.state);
    });

    // Écouteur de feedback
    const feedbackListener = MeshScanner.onFeedbackUpdated((event) => {
      setFeedbackMessages(event.messages);
    });

    // Écouteur de détection d'objet
    const objectDetectedListener = MeshScanner.onObjectDetected(() => {
      // L'objet a été détecté, vous pouvez ajouter une logique spécifique ici
    });

    // Écouteur de fin de scan
    const completeListener = MeshScanner.onScanComplete(() => {
      // Le scan est terminé
    });

    // Écouteur de progression de reconstruction
    const reconstructionProgressListener = MeshScanner.onReconstructionProgress((event) => {
      setReconstructionProgress(event.progress);
      setReconstructionStage(event.stage);
    });

    // Écouteur de fin de reconstruction
    const reconstructionCompleteListener = MeshScanner.onReconstructionComplete((event) => {
      setReconstructing(false);

      if (event.success) {
        Alert.alert(
          'Scan Complete',
          'Your 3D model has been created successfully!',
          [{ text: 'OK' }]
        );

        if (onScanComplete) {
          onScanComplete(event.modelPath, event.previewPath);
        }
      }
    });

    // Écouteur d'erreur
    const errorListener = MeshScanner.onScanError((event) => {
      Alert.alert('Error', event.message);
    });

    // Démarrer le scan
    MeshScanner.startScan({
      captureMode: 'object',
      enableOverCapture: true,
    }).catch(error => {
      console.error('Failed to start scan:', error);
      Alert.alert('Error', 'Failed to start scanning session');
    });

    // Nettoyage
    return () => {
      stateListener.remove();
      feedbackListener.remove();
      objectDetectedListener.remove();
      completeListener.remove();
      reconstructionProgressListener.remove();
      reconstructionCompleteListener.remove();
      errorListener.remove();
      MeshScanner.removeAllListeners();
    };
  }, [deviceSupported, onScanComplete]);

  // Fonction pour ajuster les dimensions de l'objet
  const handleAdjustDimension = async (dimension: 'width' | 'height' | 'depth', delta: number) => {
    const newDimensions = {
      ...objectDimensions,
      [dimension]: Math.max(0.05, (objectDimensions[dimension] || 0) + delta)
    };

    setObjectDimensions(newDimensions);

    try {
      await MeshScanner.updateObjectDimensions(newDimensions);
    } catch (error) {
      console.error('Failed to update object dimensions:', error);
    }
  };

  // Rendu des contrôles selon l'état actuel
  const renderControls = () => {
    if (!deviceSupported) {
      return (
        <View style={styles.controlsContainer}>
          <Text style={styles.errorText}>
            This device doesn't support 3D scanning
          </Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (reconstructing) {
      return (
        <View style={styles.controlsContainer}>
          <Text style={styles.stateText}>Creating 3D Model</Text>
          <Text style={styles.feedbackText}>{reconstructionStage}</Text>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${reconstructionProgress * 100}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(reconstructionProgress * 100)}%
          </Text>
          <TouchableOpacity style={styles.cancelButton} onPress={() => MeshScanner.cancelScan()}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    switch (currentState) {
      case 'notStarted':
      case 'initializing':
        return (
          <View style={styles.controlsContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.stateText}>Initializing...</Text>
          </View>
        );

      case 'ready':
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.stateText}>Ready to scan</Text>
            <Text style={styles.feedbackText}>
              Center the dot on your object and tap Continue
            </Text>
            {feedbackMessages.map((msg, index) => (
              <Text key={index} style={styles.feedbackMessage}>{msg}</Text>
            ))}
            <TouchableOpacity
              style={styles.button}
              onPress={() => MeshScanner.startDetecting()}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => MeshScanner.cancelScan().then(onClose)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'detecting':
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.stateText}>Detecting object</Text>
            <Text style={styles.feedbackText}>
              Make sure the entire object is inside the box
            </Text>
            {feedbackMessages.map((msg, index) => (
              <Text key={index} style={styles.feedbackMessage}>{msg}</Text>
            ))}

            {/* Contrôles d'ajustement des dimensions */}
            <View style={styles.dimensionControls}>
              <Text style={styles.dimensionTitle}>Adjust Object Size</Text>

              {/* Width */}
              <View style={styles.dimensionRow}>
                <Text style={styles.dimensionLabel}>
                  Width: {objectDimensions.width?.toFixed(2)}m
                </Text>
                <View style={styles.dimensionButtons}>
                  <TouchableOpacity
                    style={styles.dimensionButton}
                    onPress={() => handleAdjustDimension('width', 0.05)}>
                    <Text style={styles.buttonText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dimensionButton}
                    onPress={() => handleAdjustDimension('width', -0.05)}>
                    <Text style={styles.buttonText}>-</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Height */}
              <View style={styles.dimensionRow}>
                <Text style={styles.dimensionLabel}>
                  Height: {objectDimensions.height?.toFixed(2)}m
                </Text>
                <View style={styles.dimensionButtons}>
                  <TouchableOpacity
                    style={styles.dimensionButton}
                    onPress={() => handleAdjustDimension('height', 0.05)}>
                    <Text style={styles.buttonText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dimensionButton}
                    onPress={() => handleAdjustDimension('height', -0.05)}>
                    <Text style={styles.buttonText}>-</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Depth */}
              <View style={styles.dimensionRow}>
                <Text style={styles.dimensionLabel}>
                  Depth: {objectDimensions.depth?.toFixed(2)}m
                </Text>
                <View style={styles.dimensionButtons}>
                  <TouchableOpacity
                    style={styles.dimensionButton}
                    onPress={() => handleAdjustDimension('depth', 0.05)}>
                    <Text style={styles.buttonText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dimensionButton}
                    onPress={() => handleAdjustDimension('depth', -0.05)}>
                    <Text style={styles.buttonText}>-</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={() => MeshScanner.startCapturing()}>
              <Text style={styles.buttonText}>Start Capturing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => MeshScanner.cancelScan().then(onClose)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'objectDetected':
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.stateText}>Object Detected</Text>
            <Text style={styles.feedbackText}>
              Ready to start capturing
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => MeshScanner.startCapturing()}>
              <Text style={styles.buttonText}>Start Capturing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => MeshScanner.cancelScan().then(onClose)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'capturing':
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.stateText}>Capturing...</Text>
            <Text style={styles.feedbackText}>
              Move slowly around your object
            </Text>
            {feedbackMessages.map((msg, index) => (
              <Text key={index} style={styles.feedbackMessage}>{msg}</Text>
            ))}
            <TouchableOpacity
              style={styles.button}
              onPress={() => MeshScanner.finishScan()}>
              <Text style={styles.buttonText}>Finish</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => MeshScanner.cancelScan().then(onClose)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'completed':
      case 'processing':
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.stateText}>Processing...</Text>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        );

      case 'finished':
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.stateText}>Scan Complete</Text>
            <Text style={styles.feedbackText}>
              Ready to create 3D model
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setReconstructing(true);
                MeshScanner.reconstructModel({ detailLevel: 'medium' });
              }}>
              <Text style={styles.buttonText}>Create 3D Model</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => MeshScanner.cancelScan().then(onClose)}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        );

      case 'error':
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.errorText}>An error occurred</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => MeshScanner.cancelScan().then(onClose)}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.stateText}>State: {currentState}</Text>
            {feedbackMessages.map((msg, index) => (
              <Text key={index} style={styles.feedbackMessage}>{msg}</Text>
            ))}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => MeshScanner.cancelScan().then(onClose)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  // Vérification de la compatibilité de la plateforme
  if (Platform.OS !== 'ios' || parseInt(Platform.Version.toString(), 10) < 17) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.incompatibleContainer}>
          <Text style={styles.errorText}>
            3D Scanning requires an iOS device with iOS 17 or later.
          </Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Vue principale du scanner */}
      <View style={styles.scannerContainer}>
        <ExpoMeshScannerView style={styles.scanner} />
      </View>

      {/* Superposition des contrôles */}
      {renderControls()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerContainer: {
    flex: 1,
  },
  scanner: {
    flex: 1,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  stateText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  feedbackText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  feedbackMessage: {
    color: '#FFA500',
    fontSize: 14,
    marginBottom: 5,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#FF9800',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  incompatibleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
  },
  progressText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 20,
  },
  dimensionControls: {
    width: '100%',
    marginBottom: 20,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
  },
  dimensionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  dimensionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dimensionLabel: {
    color: 'white',
    fontSize: 14,
  },
  dimensionButtons: {
    flexDirection: 'row',
  },
  dimensionButton: {
    backgroundColor: '#2196F3',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default ScanView;