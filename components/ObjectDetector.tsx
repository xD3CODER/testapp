// components/ObjectDetectorComponent.jsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator
} from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';
import ExpoMeshScannerModule from '../modules/expo-mesh-scanner/src/ExpoMeshScannerModule';

// Récupérer le composant natif
const ExpoMeshScannerView = requireNativeViewManager('ExpoMeshScanner');

// États de l'application
const DetectionState = {
  INITIALIZING: 'initializing',
  WAITING_FOR_SURFACE: 'waitingForSurface',
  SURFACE_DETECTED: 'surfaceDetected',
  OBJECT_SELECTED: 'objectSelected',
  READY_FOR_SCAN: 'readyForScan'
};

const ObjectDetectorComponent = ({ onObjectReady, onReset }) => {
  // États
  const [detectionState, setDetectionState] = useState(DetectionState.INITIALIZING);
  const [arSupported, setARSupported] = useState(null);
  const [statusText, setStatusText] = useState("Vérification de la compatibilité...");
  const [objectPosition, setObjectPosition] = useState(null);
  const [objectDimensions, setObjectDimensions] = useState({
    width: 0.2,
    height: 0.2,
    depth: 0.2
  });
  const [isDetecting, setIsDetecting] = useState(false);

  // Vérifier si l'appareil prend en charge l'AR
  useEffect(() => {
    const checkARSupport = async () => {
      try {
        const result = await ExpoMeshScannerModule.checkSupport();
        setARSupported(result.supported);

        if (!result.supported) {
          Alert.alert('Appareil non compatible', result.reason || 'Votre appareil ne prend pas en charge la réalité augmentée.');
          setStatusText('Appareil non compatible');
        } else {
          setStatusText('Déplacez votre appareil pour détecter des surfaces planes...');
          setDetectionState(DetectionState.WAITING_FOR_SURFACE);
          setIsDetecting(true);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de la compatibilité AR:', error);
        setARSupported(false);
        setStatusText('Erreur lors de la vérification de la compatibilité');
      }
    };

    checkARSupport();

    // Nettoyage
    return () => {
      ExpoMeshScannerModule.removeAllListeners();
    };
  }, []);

  // Configurer les écouteurs d'événements
  useEffect(() => {
    if (!arSupported) return;

    // Écouteur pour les plans détectés
    const planeSubscription = ExpoMeshScannerModule.onPlaneDetected(event => {
      if (detectionState === DetectionState.WAITING_FOR_SURFACE) {
        setDetectionState(DetectionState.SURFACE_DETECTED);
        setStatusText('Surface détectée. Touchez pour sélectionner un objet.');
      }
    });

    // Écouteur pour les objets détectés
    const objectSubscription = ExpoMeshScannerModule.onObjectDetected(event => {
      setObjectPosition(event.position);
      setObjectDimensions(event.dimensions);

      if (detectionState !== DetectionState.OBJECT_SELECTED && detectionState !== DetectionState.READY_FOR_SCAN) {
        setDetectionState(DetectionState.OBJECT_SELECTED);
        setStatusText('Objet sélectionné! Ajustez les dimensions si nécessaire.');
      }
    });

    // Écouteur pour l'état du tracking
    const trackingSubscription = ExpoMeshScannerModule.onTrackingStateChanged(event => {
      if (event.state === 'normal') {
        // Bon tracking
      } else {
        // Tracking limité ou perdu
        setStatusText('Déplacez lentement votre appareil pour améliorer le tracking...');
      }
    });

    // Nettoyage
    return () => {
      planeSubscription.remove();
      objectSubscription.remove();
      trackingSubscription.remove();
    };
  }, [arSupported, detectionState]);

  // Gestionnaire de clic sur l'écran
  const handleScreenTouch = async (event) => {
    if (detectionState !== DetectionState.SURFACE_DETECTED) return;

    const { locationX, locationY } = event.nativeEvent;
    const { width, height } = Dimensions.get('window');

    // Convertir en coordonnées normalisées (0-1)
    const normalizedX = locationX / width;
    const normalizedY = locationY / height;

    try {
      // Sélectionner l'objet
      await ExpoMeshScannerModule.selectObject(
        normalizedX,
        normalizedY,
        0.1, // petite région pour précision
        0.1
      );

      setStatusText('Analyse de la sélection...');
    } catch (error) {
      console.error('Erreur lors de la sélection:', error);
    }
  };

  // Fonction pour ajuster les dimensions de l'objet
  const adjustDimension = async (dimension, delta) => {
    if (detectionState !== DetectionState.OBJECT_SELECTED && detectionState !== DetectionState.READY_FOR_SCAN) {
      return;
    }

    try {
      const newDimensions = {
        ...objectDimensions,
        [dimension]: Math.max(0.05, objectDimensions[dimension] + delta)
      };

      setObjectDimensions(newDimensions);

      await ExpoMeshScannerModule.updateObjectDimensions(
        newDimensions.width,
        newDimensions.height,
        newDimensions.depth
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour des dimensions:', error);
    }
  };

  // Fonction pour confirmer la sélection
  const confirmSelection = () => {
    setDetectionState(DetectionState.READY_FOR_SCAN);
    setStatusText('Prêt pour le scan 3D!');

    if (onObjectReady) {
      onObjectReady({
        position: objectPosition,
        dimensions: objectDimensions
      });
    }
  };

  // Fonction pour réinitialiser la détection
  const resetDetection = async () => {
    try {
      await ExpoMeshScannerModule.resetDetection();
      setDetectionState(DetectionState.WAITING_FOR_SURFACE);
      setStatusText('Déplacez votre appareil pour détecter des surfaces planes...');
      setObjectPosition(null);

      if (onReset) {
        onReset();
      }
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
    }
  };

  // Rendu si l'appareil n'est pas compatible
  if (arSupported === false) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Votre appareil ne prend pas en charge la détection d'objets AR.
        </Text>
      </View>
    );
  }

  // Rendu pendant l'initialisation
  if (arSupported === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFF" />
        <Text style={styles.loadingText}>Vérification de la compatibilité...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Vue AR native */}
      <ExpoMeshScannerView
        style={styles.arView}
        initialize={true}
        isDetecting={isDetecting}
        onTouch={handleScreenTouch}
      />

      {/* Texte d'état */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {/* Contrôles pour ajuster les dimensions */}
      {(detectionState === DetectionState.OBJECT_SELECTED || detectionState === DetectionState.READY_FOR_SCAN) && (
        <View style={styles.controlsContainer}>
          <Text style={styles.controlsTitle}>Ajuster les dimensions</Text>

          <View style={styles.dimensionControls}>
            {/* Contrôles de largeur */}
            <View style={styles.dimensionRow}>
              <Text style={styles.dimensionLabel}>
                Largeur: {objectDimensions.width.toFixed(2)}m
              </Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => adjustDimension('width', 0.05)}>
                  <Text style={styles.buttonText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => adjustDimension('width', -0.05)}>
                  <Text style={styles.buttonText}>-</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Contrôles de hauteur */}
            <View style={styles.dimensionRow}>
              <Text style={styles.dimensionLabel}>
                Hauteur: {objectDimensions.height.toFixed(2)}m
              </Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => adjustDimension('height', 0.05)}>
                  <Text style={styles.buttonText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => adjustDimension('height', -0.05)}>
                  <Text style={styles.buttonText}>-</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Contrôles de profondeur */}
            <View style={styles.dimensionRow}>
              <Text style={styles.dimensionLabel}>
                Profondeur: {objectDimensions.depth.toFixed(2)}m
              </Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => adjustDimension('depth', 0.05)}>
                  <Text style={styles.buttonText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => adjustDimension('depth', -0.05)}>
                  <Text style={styles.buttonText}>-</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Boutons d'action */}
          <View style={styles.actionButtons}>
            {detectionState === DetectionState.OBJECT_SELECTED && (
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmSelection}>
                <Text style={styles.confirmButtonText}>Confirmer</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetDetection}>
              <Text style={styles.resetButtonText}>Recommencer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  arView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
  statusContainer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statusText: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    fontSize: 16,
    padding: 10,
    borderRadius: 5,
    textAlign: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    padding: 15,
  },
  controlsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  dimensionControls: {
    marginBottom: 20,
  },
  dimensionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dimensionLabel: {
    color: 'white',
    fontSize: 16,
  },
  buttonGroup: {
    flexDirection: 'row',
  },
  adjustButton: {
    backgroundColor: '#2196F3',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    minWidth: 120,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    minWidth: 120,
    alignItems: 'center',
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default ObjectDetectorComponent;