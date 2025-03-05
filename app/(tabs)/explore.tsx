// app/(tabs)/explore.tsx - Application de scan 3D avec reconstruction avancée
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, DeviceEventEmitter, Platform, Share } from 'react-native';

// Importer les composants
import SceneScanner from '@/components/ScanView';
import PreviewARScene from '@/components/PreviewView';

const Scan3DApp = () => {
  // États
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanData, setScanData] = useState(null);
  const [modelData, setModelData] = useState(null);
  const [currentScene, setCurrentScene] = useState('scan'); // 'scan' ou 'preview'
  const [deviceSupported, setDeviceSupported] = useState(true); // Présumer le support par défaut
  const [previewMode, setPreviewMode] = useState('pointcloud'); // 'pointcloud', 'textured', 'wireframe'

  // Logs de debug
  useEffect(() => {
    console.log(`État actuel: scène=${currentScene}, scanning=${isScanning}, points=${scanProgress}`);
    console.log(`Données disponibles: ${scanData ? `Oui (${scanData.mesh?.count || 0} points, ${scanData.images?.length || 0} images)` : 'Non'}`);
    console.log(`Modèle reconstruit: ${modelData ? 'Oui' : 'Non'}`);
  }, [currentScene, isScanning, scanProgress, scanData, modelData]);

  // Écouteurs d'événements
  useEffect(() => {
    // Écouter les événements du module natif
    const startListener = DeviceEventEmitter.addListener('MESH_SCAN_STARTED', () => {
      console.log("Scan de mesh démarré");
    });

    const completeListener = DeviceEventEmitter.addListener('MESH_SCAN_COMPLETED', () => {
      console.log("Scan de mesh terminé");
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
    setModelData(null);
    setIsScanning(true);
  };

  // Terminer le scan
  const completeScan = () => {
    console.log("Arrêt du scan");
    setIsScanning(false);
  };

  // Progression du scan
  const handleScanProgress = (count) => {
    setScanProgress(count);
  };

  // Scan terminé
  const handleScanComplete = (data) => {
    console.log(`Scan terminé. Données reçues: ${data ? 'Oui' : 'Non'}`);

    // Mettre à jour les données de scan
    if (data && ((data.mesh && data.mesh.count > 0) ||
                (data.images && data.images.length > 0))) {
      console.log(`Stockage de ${data.mesh?.count || 0} points capturés et ${data.images?.length || 0} images`);
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
        "Pas assez de données capturées pour générer une prévisualisation. Essayez de scanner à nouveau.",
        [{ text: "OK" }]
      );
    }
  };

  // Modèle 3D terminé
  const handleModelComplete = (data) => {
    console.log(`Modèle 3D terminé: ${data ? 'Oui' : 'Non'}`);
    if (data) {
      setModelData(data);
      // Mettre à jour le mode de prévisualisation pour utiliser le modèle texturé
      setPreviewMode('textured');
    }
  };

  // Retour au scan
  const returnToScan = () => {
    console.log("Retour au scan");
    setCurrentScene('scan');
  };

  // Exporter le modèle 3D
  const exportModel = async () => {
    if (!modelData && !scanData) {
      Alert.alert("Erreur", "Aucun modèle à exporter");
      return;
    }

    try {
      // Si nous avons un modèle reconstruit, l'utiliser
      if (modelData) {
        const result = await MeshScanner.exportModel('obj', {
          quality: 0.9,
          includeMaterials: true
        });

        if (result.success) {
          Alert.alert(
            "Exportation réussie",
            `Le modèle 3D a été exporté vers: ${result.path}`,
            [{ text: "OK" }]
          );

          // Proposer de partager le fichier
          if (Platform.OS !== 'web') {
            try {
              await Share.share({
                url: result.path,
                message: 'Voici mon modèle 3D numérisé avec MeshScanner!'
              });
            } catch (error) {
              console.error("Erreur de partage:", error);
            }
          }
        } else {
          throw new Error("Échec de l'exportation");
        }
      } else {
        // Sinon, afficher un message pour informer l'utilisateur
        Alert.alert(
          "Reconstruction nécessaire",
          "Pour obtenir un fichier 3D de meilleure qualité, veuillez d'abord lancer la reconstruction avancée.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      Alert.alert(
        "Erreur d'exportation",
        `Une erreur est survenue: ${error.message}`,
        [{ text: "OK" }]
      );
    }
  };

  // Changer le mode de prévisualisation
  const togglePreviewMode = () => {
    const modes = ['pointcloud', 'wireframe', 'textured'];
    const currentIndex = modes.indexOf(previewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setPreviewMode(modes[nextIndex]);
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
              Votre appareil ne supporte pas le scan 3D optimal.
              Un iPhone/iPad avec LiDAR est recommandé pour de meilleurs résultats.
            </Text>
          )}
        </View>
      );
    } else {
      return (
        <View style={styles.previewControls}>
          <Text style={styles.previewTitle}>Prévisualisation 3D</Text>
          <Text style={styles.previewInfo}>
            {scanData?.mesh?.count || 0} points capturés
            {scanData?.images && ` • ${scanData.images.length} images`}
            {modelData && ' • Modèle reconstruit'}
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.previewButton]}
              onPress={returnToScan}
            >
              <Text style={styles.buttonText}>Nouveau scan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.modeButton]}
              onPress={togglePreviewMode}
            >
              <Text style={styles.buttonText}>
                Mode: {previewMode === 'pointcloud' ? 'Points' :
                       previewMode === 'wireframe' ? 'Filaire' : 'Texturé'}
              </Text>
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

  // Notification qu'un appareil compatible est requis
  const onDeviceNotSupported = () => {
    setDeviceSupported(false);
  };

  return (
    <View style={styles.container}>
      {currentScene === 'scan' && (
        <View style={styles.scanContainer}>
          {/* Scanner avec photogrammétrie */}
          <SceneScanner
            isScanning={isScanning}
            onScanProgress={handleScanProgress}
            onScanComplete={handleScanComplete}
            onDeviceNotSupported={onDeviceNotSupported}
            onModelComplete={handleModelComplete}
          />
        </View>
      )}

      {currentScene === 'preview' && (scanData || modelData) && (
        <PreviewARScene
          scanData={scanData}
          modelData={modelData}
          displayMode={previewMode}
        />
      )}

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
  modeButton: {
    backgroundColor: '#9C27B0',
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
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  }
});

export default Scan3DApp;