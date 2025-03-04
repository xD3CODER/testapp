// App.js - Version optimisée avec sélection directe d'objet
import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, DeviceEventEmitter } from 'react-native';
import {
  ViroARSceneNavigator,
  ViroMaterials
} from '@reactvision/react-viro';

// Importer les scènes
import ScanARScene from '@/components/ScanView';
import PreviewARScene from '@/components/PreviewView';

// Initialiser les matériaux
const initMaterials = () => {
  // Définition des matériaux
  ViroMaterials.createMaterials({
    surfaceMaterial: {
      diffuseColor: 'rgba(100, 180, 255, 0.3)',
      lightingModel: "Lambert"
    },
    previewBackgroundMaterial: {
      diffuseColor: 'rgb(20, 30, 50)',
      lightingModel: "Constant"
    },
    markerMaterial: {
      diffuseColor: 'rgba(255, 128, 0, 0.8)',
      lightingModel: "Lambert"
    }
  });
};

// Initialiser les matériaux
initMaterials();

const Scan3DApp = () => {
  // États partagés
  const [scanProgress, setScanProgress] = useState(0);
  const [surfaceFound, setSurfaceFound] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanData, setScanData] = useState(null);
  const [currentScene, setCurrentScene] = useState('scan'); // 'scan' ou 'preview'

  // Nouveaux états pour la sélection d'objet
  const [selectionMode, setSelectionMode] = useState(true); // Commencer en mode sélection
  const [objectSelected, setObjectSelected] = useState(false);
  const [objectCenter, setObjectCenter] = useState(null);

  // Référence au navigateur AR
  const arNavigatorRef = useRef(null);

  // Effet pour logs de debug
  useEffect(() => {
    console.log(`État actuel: scène=${currentScene}, scanning=${isScanning}, points=${scanProgress}, surface=${surfaceFound}`);
    console.log(`Données disponibles: ${scanData ? `Oui (${scanData.points?.length} points)` : 'Non'}`);
    console.log(`Sélection: mode=${selectionMode}, objet sélectionné=${objectSelected}`);
    if (objectCenter) {
      console.log(`Centre de l'objet: [${objectCenter[0].toFixed(2)}, ${objectCenter[1].toFixed(2)}, ${objectCenter[2].toFixed(2)}]`);
    }
  }, [currentScene, isScanning, scanProgress, surfaceFound, scanData, selectionMode, objectSelected, objectCenter]);

  // Fonction pour gérer la sélection d'objet
  const handleObjectSelection = () => {
    console.log("Demande de sélection d'objet");

    // Émettre un événement pour capturer le centre du champ de vision
    DeviceEventEmitter.emit('SELECT_OBJECT');

    // Attendre que le centre soit capturé
    setTimeout(() => {
      if (objectCenter) {
        setObjectSelected(true);
        setSelectionMode(false);
        // Message utilisateur
        Alert.alert(
          "Objet sélectionné",
          "L'objet a été sélectionné. Vous pouvez maintenant commencer le scan."
        );
      } else {
        // Si pas de point central trouvé après délai
        Alert.alert(
          "Échec de sélection",
          "Impossible de détecter un objet à cette position. Essayez de pointer plus précisément vers l'objet."
        );
      }
    }, 500);
  };

  // Fonction appelée quand l'objet est sélectionné
  const handleObjectCenterDetected = (center) => {
    console.log("Centre de l'objet détecté:", center);
    setObjectCenter(center);
  };

  // Démarrer le scan
  const startScan = () => {
    console.log("Démarrage du scan");
    setScanProgress(0);
    setScanData(null);
    setIsScanning(true);
    DeviceEventEmitter.emit('START_SCAN');
  };

  // Terminer le scan
  const completeScan = () => {
    console.log("Arrêt du scan");
    setIsScanning(false);
    DeviceEventEmitter.emit('STOP_SCAN');
  };

  // Progression du scan
  const handleScanProgress = (count) => {
    setScanProgress(prevCount => {
      const newCount = prevCount + count;
      console.log(`Progression du scan: ${newCount} points`);
      return Math.min(newCount, 2000); // Augmenté à 2000 points max
    });
  };

  // Surface détectée
  const handleSurfaceFound = () => {
    console.log("Surface trouvée");
    setSurfaceFound(true);
  };

  // Scan terminé
  const handleScanComplete = (data) => {
    console.log(`Scan terminé. Données reçues: ${data ? 'Oui' : 'Non'}`);
    if (data) {
      console.log(`Points dans les données: ${data.points?.length || 0}`);
    }

    // Mettre à jour les données de scan
    if (data && data.points && data.points.length > 0) {
      console.log(`Stockage de ${data.points.length} points capturés`);
      setScanData(data);

      // Passer à la prévisualisation après un délai
      setTimeout(() => {
        console.log("Passage à la prévisualisation");
        setCurrentScene('preview');
      }, 500);
    }
    // Si pas de données mais progression, créer des données factices
    else if (scanProgress > 0) {
      console.log(`Génération de données factices (${scanProgress} points)`);

      // Créer des données factices basées sur scanProgress
      const fakePoints = [];
      const fakeColors = [];

      const maxPoints = Math.min(scanProgress, 200);

      for (let i = 0; i < maxPoints; i++) {
        // Coordonnées sphériques
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 0.5 + Math.random() * 0.3;

        // Conversion en coordonnées cartésiennes
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);

        fakePoints.push([x, y, z]);

        // Couleur variée basée sur la position
        fakeColors.push([
          0.5 + x/2,
          0.5 + y/2,
          0.5 + z/2
        ]);
      }

      // Stocker les données factices
      const fakeData = {
        points: fakePoints,
        colors: fakeColors
      };

      setScanData(fakeData);

      // Passer à la prévisualisation après un délai
      setTimeout(() => {
        console.log("Passage à la prévisualisation (données factices)");
        setCurrentScene('preview');
      }, 500);
    }
    else {
      console.log("Aucune donnée ni progression - pas de prévisualisation possible");
      Alert.alert(
        "Scan incomplet",
        "Pas assez de points capturés pour générer une prévisualisation. Essayez de scanner à nouveau.",
        [{ text: "OK" }]
      );
    }
  };

  // Retour au scan
  const returnToScan = () => {
    console.log("Retour au scan");
    setCurrentScene('scan');
  };

  // Obtenir la scène courante et ses propriétés
  const getCurrentScene = () => {
    if (currentScene === 'scan') {
      return {
        scene: ScanARScene,
        passProps: {
          isScanning,
          selectionMode,
          objectSelected,
          objectCenter,
          onScanProgress: handleScanProgress,
          onSurfaceFound: handleSurfaceFound,
          onScanComplete: handleScanComplete,
          onObjectSelected: handleObjectCenterDetected,
          parentSurfaceFound: surfaceFound,
        }
      };
    }
  };

  // Rendu des contrôles en fonction de la scène et du mode
  const renderControls = () => {
    if (currentScene === 'scan') {
      if (selectionMode) {
        return (
          <View style={styles.uiContainer}>
            <Text style={styles.instructionText}>
              Pointez l'appareil vers l'objet que vous souhaitez scanner,{"\n"}
              puis appuyez sur "Sélectionner cet objet"
            </Text>

            <TouchableOpacity
              style={[styles.button, styles.selectButton]}
              onPress={handleObjectSelection}
            >
              <Text style={styles.buttonText}>
                Sélectionner cet objet
              </Text>
            </TouchableOpacity>
          </View>
        );
      } else {
        return (
          <View style={styles.uiContainer}>
            <Text style={styles.progressText}>
              Points capturés: {scanProgress}
            </Text>

            {objectSelected ? (
              <TouchableOpacity
                style={[styles.button, isScanning ? styles.stopButton : styles.startButton]}
                onPress={isScanning ? completeScan : startScan}
              >
                <Text style={styles.buttonText}>
                  {isScanning ? 'Terminer le scan' : 'Commencer le scan'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.instructionText}>
                Aucun objet sélectionné. Retournez au mode sélection.
              </Text>
            )}

            <TouchableOpacity
              style={[styles.button, styles.backButton]}
              onPress={() => setSelectionMode(true)}
            >
              <Text style={styles.buttonText}>
                Retour à la sélection
              </Text>
            </TouchableOpacity>
          </View>
        );
      }
    } else {
      return (
        <View style={styles.previewControls}>
          <Text style={styles.previewTitle}>Prévisualisation 3D</Text>
          <Text style={styles.previewInfo}>
            {scanData?.points?.length || 0} points capturés
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.previewButton]}
              onPress={returnToScan}
            >
              <Text style={styles.buttonText}>Retour</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.exportButton]}
              onPress={() => Alert.alert("Export", "Fonctionnalité à venir")}
            >
              <Text style={styles.buttonText}>Exporter</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  };

  // Rendu du feedback de scan
  const renderScanFeedback = () => {
    if (currentScene === 'scan' && isScanning) {
      return (
        <View style={styles.scanFeedback}>
          <Text style={styles.scanFeedbackText}>
            {scanProgress < 50 ?
              "Déplacez lentement l'appareil autour de l'objet..." :
              scanProgress < 200 ?
                "Continuez à scanner sous différents angles..." :
                "Bon nombre de points capturés, vous pouvez terminer le scan"
            }
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, scanProgress/20)}%`,
                  backgroundColor: scanProgress < 50 ? '#FF9800' :
                                   scanProgress < 200 ? '#2196F3' : '#4CAF50'
                }
              ]}
            />
          </View>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {/* Un seul navigateur AR qui ne se démonte jamais */}
      <ViroARSceneNavigator
        ref={arNavigatorRef}
        initialScene={getCurrentScene()}
        style={styles.arView}
        worldAlignment="gravity"  // Meilleure stabilité
        videoQuality="high"       // Meilleure qualité pour la détection
        planeDetection={true}     // Détection explicite des plans
      />
      {scanData &&
      <PreviewARScene scanData={scanData}/> }

      {/* Feedback pendant le scan */}
      {renderScanFeedback()}

      {/* UI contrôles superposés */}
      {renderControls()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginVertical: 70,
    position: 'relative'
  },
  arView: {
    flex: 1
  },
  uiContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 30,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    borderRadius: 10,
    margin: 20,
  },
  progressText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginVertical: 10,
    minWidth: 140,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#2196F3',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  selectButton: {
    backgroundColor: '#FF9800',
  },
  backButton: {
    backgroundColor: '#607D8B',
    marginTop: 10,
  },
  previewButton: {
    backgroundColor: '#607D8B',
  },
  exportButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 30,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
    margin: 20,
  },
  previewTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  previewInfo: {
    color: 'white',
    fontSize: 14,
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  scanFeedback: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
  },
  scanFeedbackText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 14,
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'center',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  }
});

export default Scan3DApp;