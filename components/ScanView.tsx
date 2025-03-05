// components/ScanView.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Alert,
  DeviceEventEmitter,
  Modal,
  ActivityIndicator
} from 'react-native';

// Importer notre module natif amélioré
import MeshScanner from '../modules/expo-mesh-scanner/src/index';
import { CaptureMode, ImageCapturedEvent, GuidanceUpdateEvent, MeshUpdateEvent, ReconstructionProgressEvent } from '../modules/expo-mesh-scanner/src/ExpoMeshScannerModule';
import ExpoMeshScannerView from '../modules/expo-mesh-scanner/src/ExpoMeshScannerView';

interface ScanViewProps {
  isScanning: boolean;
  onScanProgress: (count: number) => void;
  onScanComplete: (data: any) => void;
  onDeviceNotSupported?: () => void;
  onModelComplete?: (modelData: any) => void;
}

// États du scan
enum ScanStage {
  IDLE = 'idle',
  OBJECT_SELECTION = 'selection',
  SCANNING = 'scanning',
  PROCESSING = 'processing',
  RECONSTRUCTING = 'reconstructing'
}

const SceneScanner: React.FC<ScanViewProps> = ({
  isScanning,
  onScanProgress,
  onScanComplete,
  onDeviceNotSupported,
  onModelComplete
}) => {
  // États
  const [scanStage, setScanStage] = useState<ScanStage>(ScanStage.IDLE);
  const [deviceSupported, setDeviceSupported] = useState<boolean>(false);
  const [hasLiDAR, setHasLiDAR] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('Initialisation...');
  const [objectSelection, setObjectSelection] = useState<{x: number, y: number, width: number, height: number} | null>(null);

  // Métriques de scan
  const [vertexCount, setVertexCount] = useState<number>(0);
  const [imageCount, setImageCount] = useState<number>(0);
  const [currentAngle, setCurrentAngle] = useState<number>(0);
  const [scanProgress, setScanProgress] = useState<number>(0);

  // État de reconstruction
  const [isReconstructing, setIsReconstructing] = useState<boolean>(false);
  const [reconstructionProgress, setReconstructionProgress] = useState<number>(0);
  const [reconstructionStage, setReconstructionStage] = useState<string>('');

  // Animation
  const rotationAnim = useRef(new Animated.Value(0)).current;

  // Références
  const scanStartTimeRef = useRef<number | null>(null);
  const scanDataRef = useRef<any>(null);

  // Vérifier la compatibilité de l'appareil au montage
  useEffect(() => {
    const checkDeviceSupport = async () => {
      try {
        const support = await MeshScanner.checkSupport();
        setDeviceSupported(support.supported);
        setHasLiDAR(support.hasLiDAR);

        if (support.supported) {
          setStatusText('Prêt à scanner. Veuillez sélectionner un objet.');
          setScanStage(ScanStage.OBJECT_SELECTION);
        } else {
          setStatusText(`Appareil non compatible: ${support.reason || 'Capteurs requis non disponibles'}`);
          onDeviceNotSupported?.();
          Alert.alert(
            'Appareil non compatible',
            `${support.reason || 'Votre appareil ne prend pas en charge le scan 3D.'}`,
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de la compatibilité:', error);
        setStatusText('Erreur de vérification de compatibilité');
      }
    };

    checkDeviceSupport();

    // Nettoyage
    return () => {
      MeshScanner.removeAllListeners();
    };
  }, []);

  // Configurer les écouteurs d'événements
  useEffect(() => {
    if (!deviceSupported) return;

    // Écouteur pour les mises à jour du mesh
    const meshUpdateListener = MeshScanner.onMeshUpdate((data: MeshUpdateEvent) => {
      setVertexCount(data.vertices);
      setImageCount(data.images);
      setCurrentAngle(data.currentAngle);

      // Calculer la progression (à adapter selon vos besoins)
      const vertexProgress = Math.min(1, data.vertices / 5000); // 5000 points = 100%
      const imageProgress = Math.min(1, data.images / 36); // 36 images = 100%

      // Combiner les deux métriques
      const combinedProgress = (vertexProgress + imageProgress) / 2;
      setScanProgress(combinedProgress);

      // Notifier le parent
      onScanProgress(data.vertices);

      // Mettre à jour l'animation
      Animated.timing(rotationAnim, {
        toValue: data.currentAngle / 360,
        duration: 300,
        useNativeDriver: true
      }).start();
    });

    // Écouteur pour les images capturées
    const imageCapturedListener = MeshScanner.onImageCaptured((data: ImageCapturedEvent) => {
      setImageCount(data.count);
      setCurrentAngle(data.angle);
    });

    // Écouteur pour le guidage
    const guidanceListener = MeshScanner.onGuidanceUpdate((data: GuidanceUpdateEvent) => {
      setCurrentAngle(data.currentAngle);
      setScanProgress(data.progress);
    });

    // Écouteur pour la fin du scan
    const scanCompleteListener = MeshScanner.onScanComplete((data) => {
      console.log(`Scan complet: ${data.mesh.count} vertices, ${data.images.length} images`);
      setScanStage(ScanStage.PROCESSING);
      setStatusText('Traitement du scan...');

      // Stocker les données de scan pour la reconstruction
      scanDataRef.current = data;

      // Notifier le parent avec les données complètes
      setTimeout(() => {
        onScanComplete(data);
        // Proposer la reconstruction avancée
        Alert.alert(
          "Scan terminé",
          `Scan réussi avec ${data.mesh.count} points et ${data.images.length} images. Voulez-vous générer un modèle 3D de haute qualité ?`,
          [
            {
              text: "Non",
              style: "cancel"
            },
            {
              text: "Oui",
              onPress: startAdvancedReconstruction
            }
          ]
        );
      }, 1000);
    });

    // Écouteur pour la progression de la reconstruction
    const reconstructionProgressListener = MeshScanner.onReconstructionProgress((data: ReconstructionProgressEvent) => {
      setReconstructionProgress(data.progress);
      setReconstructionStage(data.stage);
    });

    // Écouteur pour la fin de la reconstruction
    const reconstructionCompleteListener = MeshScanner.onReconstructionComplete((data) => {
      setIsReconstructing(false);

      if (data.success) {
        Alert.alert(
          "Reconstruction terminée",
          "Le modèle 3D a été généré avec succès !",
          [{ text: "OK" }]
        );

        // Notifier le parent avec le modèle complet
        if (onModelComplete) {
          onModelComplete(data.model);
        }
      } else {
        Alert.alert(
          "Erreur de reconstruction",
          data.error || "Une erreur est survenue pendant la reconstruction",
          [{ text: "OK" }]
        );
      }
    });

    // Écouteur pour les erreurs
    const errorListener = MeshScanner.onScanError((error) => {
      console.error('Erreur de scanning:', error);
      setStatusText(`Erreur: ${error.message || 'Erreur inconnue'}`);

      Alert.alert(
        'Erreur de scan',
        `Une erreur est survenue: ${error.message || 'Erreur inconnue'}`,
        [{ text: 'OK' }]
      );
    });

    // Nettoyage
    return () => {
      meshUpdateListener.remove();
      imageCapturedListener.remove();
      guidanceListener.remove();
      scanCompleteListener.remove();
      reconstructionProgressListener.remove();
      reconstructionCompleteListener.remove();
      errorListener.remove();
    };
  }, [deviceSupported, onScanProgress, onScanComplete, onModelComplete, rotationAnim]);

  // Démarrer la reconstruction avancée
  const startAdvancedReconstruction = async () => {
    try {
      setIsReconstructing(true);
      setScanStage(ScanStage.RECONSTRUCTING);
      setReconstructionProgress(0);
      setReconstructionStage('Initialisation');

      // Configurer les options de reconstruction
      await MeshScanner.configureReconstruction({
        meshSimplificationFactor: 0.8,  // Conserver 80% des détails
        textureWidth: 2048,
        textureHeight: 2048,
        enableRefinement: true,
        refinementIterations: 3,
        pointCloudDensity: 0.9
      });

      // Démarrer la reconstruction
      await MeshScanner.startReconstruction();
    } catch (error) {
      setIsReconstructing(false);
      Alert.alert(
        "Erreur",
        `Impossible de démarrer la reconstruction: ${error.message}`,
        [{ text: "OK" }]
      );
    }
  };

  // Annuler la reconstruction
  const cancelReconstruction = async () => {
    try {
      await MeshScanner.cancelReconstruction();
      setIsReconstructing(false);
    } catch (error) {
      console.error("Erreur lors de l'annulation:", error);
    }
  };

  // Gérer les changements d'état de scan
  useEffect(() => {
    const handleScanState = async () => {
      if (!deviceSupported) return;

      try {
        if (isScanning) {
          if (scanStage === ScanStage.OBJECT_SELECTION) {
            if (objectSelection) {
              // Démarrer le scan avec l'objet sélectionné
              setScanStage(ScanStage.SCANNING);
              setStatusText('Scan en cours... Tournez lentement autour de l\'objet');
              setVertexCount(0);
              setImageCount(0);
              scanStartTimeRef.current = Date.now();

              // Configurer les options de scan
              await MeshScanner.startScan({
                radius: 2.0,
                captureMode: 'guided' as CaptureMode,
                captureInterval: 1.5,
                maxImages: 36,
                targetObject: objectSelection
              });

              // Notifier DeviceEventEmitter pour compatibilité avec du code existant
              DeviceEventEmitter.emit('MESH_SCAN_STARTED');
            } else {
              setStatusText('Veuillez d\'abord sélectionner l\'objet à scanner');
            }
          }
        } else if (scanStage === ScanStage.SCANNING) {
          // Arrêter le scan
          setStatusText('Finalisation du scan...');

          await MeshScanner.stopScan();
          scanStartTimeRef.current = null;

          // La notification de fin sera gérée par l'écouteur onScanComplete
        }
      } catch (error) {
        console.error('Erreur lors du scan:', error);
        setStatusText(`Erreur: ${error.message || 'Erreur inconnue'}`);
      }
    };

    handleScanState();
  }, [isScanning, scanStage, deviceSupported, objectSelection]);

  // Fonction pour sélectionner l'objet
  const handleObjectSelection = async (x: number, y: number) => {
    // Dans une implémentation réelle, on pourrait utiliser un algorithme de détection d'objets
    // Ici nous simulons simplement en créant un rectangle autour du point touché
    const { width, height } = Dimensions.get('window');
    const objectWidth = width * 0.6;
    const objectHeight = height * 0.3;

    const selection = {
      x: Math.max(0, x - objectWidth/2),
      y: Math.max(0, y - objectHeight/2),
      width: objectWidth,
      height: objectHeight
    };

    // Envoyer la sélection au module natif
    try {
       await MeshScanner.selectObject(selection.x, selection.y, selection.width, selection.height);

  // 2. Ensuite, mettez à jour l'état pour la vue
      setObjectSelection(selection);
      setStatusText('Objet sélectionné. Appuyez sur "Commencer le scan" pour continuer.');
    } catch (error) {
      console.error('Erreur lors de la sélection:', error);
    }
  };

  // Capturer une image manuellement (en mode manuel)
  const captureImage = async () => {
    if (scanStage !== ScanStage.SCANNING) return;

    try {
      const result = await MeshScanner.captureImage();
      console.log(`Image capturée. Total: ${result.imageCount}`);
    } catch (error) {
      console.error('Erreur de capture:', error);
    }
  };

  // Rendu de l'interface graphique en fonction de l'étape
  const renderStageUI = () => {
    switch (scanStage) {
      case ScanStage.OBJECT_SELECTION:
        return (
          <View style={styles.selectionOverlay}>
            <Text style={styles.instructionText}>
              Touchez l'objet que vous souhaitez scanner
            </Text>
            {objectSelection && (
              <View
                style={[
                  styles.selectionRect,
                  {
                    left: objectSelection.x,
                    top: objectSelection.y,
                    width: objectSelection.width,
                    height: objectSelection.height
                  }
                ]}
              />
            )}
          </View>
        );

      case ScanStage.SCANNING:
        return (
          <View style={styles.scanningOverlay}>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                {imageCount} images capturées
              </Text>
              {hasLiDAR && (
                <Text style={styles.progressText}>
                  {vertexCount} points 3D capturés
                </Text>
              )}

              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${scanProgress * 100}%` }
                  ]}
                />
              </View>
            </View>

            <View style={styles.angleIndicator}>
              <Animated.View
                style={[
                  styles.angleArrow,
                  {
                    transform: [
                      {
                        rotate: rotationAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg']
                        })
                      }
                    ]
                  }
                ]}
              />
              <Text style={styles.angleText}>{Math.round(currentAngle)}°</Text>
            </View>

            <Text style={styles.instructionText}>
              {scanProgress < 0.3
                ? "Déplacez-vous lentement autour de l'objet..."
                : scanProgress < 0.7
                  ? "Continuez à scanner tous les côtés de l'objet..."
                  : "Excellente progression! Complétez le tour pour finir..."
              }
            </Text>
          </View>
        );

      case ScanStage.PROCESSING:
        return (
          <View style={styles.processingOverlay}>
            <Text style={styles.processingText}>Traitement en cours...</Text>
            <Text style={styles.processingSubText}>
              Création du modèle 3D à partir de {imageCount} images et {vertexCount} points
            </Text>
          </View>
        );

      case ScanStage.RECONSTRUCTING:
        return (
          <View style={styles.processingOverlay}>
            <Text style={styles.processingText}>Reconstruction avancée en cours</Text>
            <Text style={styles.processingSubText}>
              {reconstructionStage} - {Math.round(reconstructionProgress * 100)}%
            </Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${reconstructionProgress * 100}%` }
                ]}
              />
            </View>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelReconstruction}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  // Rendu principal avec la vue AR native si disponible
  return (
    <View style={styles.container}>
      {/* Vue AR native pour le scan en temps réel */}
      {hasLiDAR ? (
        <ExpoMeshScannerView
          style={styles.arView}
          initialize={true}
          isScanning={scanStage === ScanStage.SCANNING}
          showMesh={true}
          showGuides={true}
          showCapturedImages={true}
          targetObject={objectSelection || undefined}
          onInitialized={() => console.log("Vue AR initialisée")}
          onTouch={(event) => {
            if (scanStage === ScanStage.OBJECT_SELECTION) {
              const { rawX, rawY } = event.nativeEvent;
              handleObjectSelection(rawX, rawY);
            }
          }}
          onTrackingStateChanged={(event) => {
            const { state } = event.nativeEvent;
            if (state !== 'normal') {
              console.log(`Tracking state changed: ${state}`);
            }
          }}
        />
      ) : (
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.placeholderText}>
            Caméra AR indisponible
          </Text>
        </View>
      )}

      {/* Interface utilisateur de scan superposée */}
      {renderStageUI()}

      {/* Bannière de statut */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {/* Bouton de capture manuelle (utilisable en scan manuel) */}
      {scanStage === ScanStage.SCANNING && (
        <TouchableOpacity
          style={styles.captureButton}
          onPress={captureImage}
        >
          <Text style={styles.captureButtonText}>Capture</Text>
        </TouchableOpacity>
      )}

      {/* Modal de reconstruction en cours */}
      <Modal
        transparent={true}
        visible={isReconstructing}
        animationType="fade"
        onRequestClose={cancelReconstruction}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reconstruction 3D</Text>
            <Text style={styles.modalSubtitle}>{reconstructionStage}</Text>
            <ActivityIndicator size="large" color="#2196F3" style={styles.modalSpinner} />
            <View style={styles.modalProgressContainer}>
              <View style={[styles.modalProgressBar, { width: `${reconstructionProgress * 100}%` }]} />
            </View>
            <Text style={styles.modalProgressText}>{Math.round(reconstructionProgress * 100)}%</Text>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={cancelReconstruction}
            >
              <Text style={styles.modalCancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  arView: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  statusContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  statusText: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionRect: {
    borderWidth: 2,
    borderColor: '#00FF00',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0,255,0,0.1)',
    position: 'absolute',
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 40,
  },
  progressContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 60,
  },
  progressText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 5,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00FFFF',
  },
  angleIndicator: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  angleArrow: {
    width: 100,
    height: 4,
    backgroundColor: '#FFFF00',
    position: 'absolute',
  },
  angleText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  instructionText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    textAlign: 'center',
    width: '100%',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  processingText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  processingSubText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  captureButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  captureButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,0,0,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 30,
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },

  // Styles pour le modal de reconstruction
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalSubtitle: {
    color: 'white',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalSpinner: {
    marginBottom: 20,
  },
  modalProgressContainer: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  modalProgressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
  },
  modalProgressText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
    marginBottom: 20,
  },
  modalCancelButton: {
    backgroundColor: '#F44336',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  modalCancelButtonText: {
    color: 'white',
    fontWeight: 'bold',
  }
});

export default SceneScanner;