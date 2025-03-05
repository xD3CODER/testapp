// Mise à jour du composant explore.tsx pour utiliser le nouveau scanner de mesh
import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, DeviceEventEmitter } from 'react-native';
import {
  ViroARSceneNavigator,
  ViroMaterials
} from '@reactvision/react-viro';

// Importer les composants
import SceneScanner from '@/components/ScanView'; // Notre nouveau scanner de mesh
import PreviewARScene from '@/components/PreviewView';

// Initialiser les matériaux
const initMaterials = () => {
  ViroMaterials.createMaterials({
    previewBackgroundMaterial: {
      diffuseColor: 'rgb(20, 30, 50)',
      lightingModel: "Constant"
    },
    defaultPointMaterial: {
      diffuseColor: 'rgb(200, 200, 200)',
      lightingModel: "Lambert"
    }
  });
};

// Initialiser les matériaux
initMaterials();

const Scan3DApp = () => {
  // États
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanData, setScanData] = useState(null);
  const [currentScene, setCurrentScene] = useState('scan'); // 'scan' ou 'preview'
  const [deviceSupported, setDeviceSupported] = useState(true); // Présumer le support par défaut

  // Référence au navigateur AR
  const arNavigatorRef = useRef(null);

  // Logs de debug
  useEffect(() => {
    console.log(`État actuel: scène=${currentScene}, scanning=${isScanning}, points=${scanProgress}`);
    console.log(`Données disponibles: ${scanData ? `Oui (${scanData.points?.length} points)` : 'Non'}`);
  }, [currentScene, isScanning, scanProgress, scanData]);

  // Écouteurs d'événements personnalisés
  useEffect(() => {
    // Écouter les événements du module natif
    const startListener = DeviceEventEmitter.addListener('MESH_SCAN_STARTED', () => {
      console.log("Scan de mesh démarré via natif");
    });
    
    const completeListener = DeviceEventEmitter.addListener('MESH_SCAN_COMPLETED', () => {
      console.log("Scan de mesh terminé via natif");
    });
    
    return () => {
      startListener.remove();
      completeListener.remove();
    };
  }, []);

  // Démarrer le scan
  const startScan = () => {
    console.log("Démarrage du scan");
    setScanProgress(0);
    setScanData(null);
    setIsScanning(true);
  };

  // Terminer le scan
  const completeScan = () => {
    console.log("Arrêt du scan");
    setIsScanning(false);
  };

  // Progression du scan
  const handleScanProgress = (count) => {
    setScanProgress(prevCount => {
      const newCount = prevCount + count;
      console.log(`Progression du scan: ${newCount} points`);
      return newCount;
    });
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

  // Exporter le modèle 3D
  const exportModel = () => {
    Alert.alert(
      "Exportation",
      "Fonctionnalité à venir - Le modèle 3D sera exportable en OBJ/PLY/GLTF",
      [{ text: "OK" }]
    );
  };

  // Rendu des contrôles en fonction de la scène
  const renderControls = () => {
    if (currentScene === 'scan') {
      return (
        <View style={styles.uiContainer}>
          <Text style={styles.progressText}>
            Points capturés: {scanProgress}
          </Text>

          <TouchableOpacity
            style={[styles.button, isScanning ? styles.stopButton : styles.startButton]}
            onPress={isScanning ? completeScan : startScan}
            disabled={!deviceSupported}
          >
            <Text style={styles.buttonText}>
              {isScanning ? 'Terminer le scan' : 'Commencer le scan'}
            </Text>
          </TouchableOpacity>
          
          {!deviceSupported && (
            <Text style={styles.warningText}>
              Votre appareil ne supporte pas le scan de mesh 3D.
              Un iPhone/iPad avec LiDAR est recommandé.
            </Text>
          )}
        </View>
      );
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
              onPress={exportModel}
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
            {scanProgress < 500 ?
              "Déplacez-vous lentement autour de l'objet..." :
              scanProgress < 2000 ?
                "Continuez à scanner pour capturer tous les détails..." :
                "Excellent! Vous pouvez terminer le scan ou continuer pour plus de détails"
            }
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, scanProgress/50)}%`,
                  backgroundColor: scanProgress < 500 ? '#FF9800' :
                                   scanProgress < 2000 ? '#2196F3' : '#4CAF50'
                }
              ]}
            />
          </View>
        </View>
      );
    }
    return null;
  };

  // Notification qu'un appareil compatible est requis
  const onDeviceNotSupported = () => {
    setDeviceSupported(false);
  };

  return (
    <View style={styles.container}>
      {currentScene === 'scan' && (
        <View style={styles.scanContainer}>
          {/* Scanner de mesh  */}
          <SceneScanner
            isScanning={isScanning}
            onScanProgress={handleScanProgress}
            onScanComplete={handleScanComplete}
            onDeviceNotSupported={onDeviceNotSupported}
          />
        </View>
      )}
      
      {currentScene === 'preview' && scanData && (
        <PreviewARScene scanData={scanData}/>
      )}

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
  scanContainer: {
    flex: 1,
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
  warningText: {
    color: '#FFA500',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    padding: 10,
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