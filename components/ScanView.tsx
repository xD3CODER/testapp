// ScanView.tsx - Version améliorée utilisant le module natif de mesh scanning
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, DeviceEventEmitter } from 'react-native';
import MeshScanner from '../modules/expo-mesh-scanner'; // Importez le module

interface ScanViewProps {
  isScanning: boolean;
  onScanProgress: (count: number) => void;
  onScanComplete: (data: any) => void;
}

const SceneScanner: React.FC<ScanViewProps> = ({
  isScanning,
  onScanProgress,
  onScanComplete
}) => {
  // États
  const [deviceSupported, setDeviceSupported] = useState<boolean>(false);
  const [hasLiDAR, setHasLiDAR] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('Initialisation...');
  const [vertexCount, setVertexCount] = useState<number>(0);
  const [faceCount, setFaceCount] = useState<number>(0);

  // Références
  const scanStartTimeRef = useRef<number | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Vérifier la compatibilité de l'appareil au chargement
  useEffect(() => {
    const checkDeviceSupport = async () => {
      try {
        const support = await MeshScanner.checkSupport();
        setDeviceSupported(support.supported);
        setHasLiDAR(support.hasLiDAR || false);

        if (support.supported) {
          setStatusText('Prêt à scanner. Appuyez sur "Commencer le scan"');
        } else {
          setStatusText(`Appareil non compatible: ${support.reason || 'LiDAR requis'}`);
          Alert.alert(
            'Appareil non compatible',
            'Votre appareil ne prend pas en charge le scan de mesh 3D. Un iPhone ou iPad Pro avec capteur LiDAR est recommandé.',
            [{ text: 'OK' }]
          );
        }

        isInitializedRef.current = true;
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

  // Configurer les écouteurs d'événements pour le module natif
  useEffect(() => {
    if (!deviceSupported) return;

    // Écouteur pour les mises à jour de mesh
    const meshUpdateListener = MeshScanner.onMeshUpdate((data) => {
      if (data && data.vertices) {
        setVertexCount(data.vertices);
        setFaceCount(data.faces || 0);

        // Notifier le parent de la progression
        if (onScanProgress) {
          onScanProgress(data.vertices);
        }
      }
    });

    // Écouteur pour la fin du scan
    const scanCompleteListener = MeshScanner.onScanComplete((data) => {
      console.log(`Scan complet: ${data.count} vertices`);

      // Transformer les données dans le format attendu par l'application
      const points = [];
      const colors = [];

      // Convertir le tableau de vertices en points [x,y,z]
      for (let i = 0; i < data.vertices.length; i += 3) {
        if (i + 2 < data.vertices.length) {
          points.push([
            data.vertices[i],
            data.vertices[i + 1],
            data.vertices[i + 2]
          ]);

          // Créer des couleurs en fonction de la profondeur (y)
          const y = data.vertices[i + 1];
          const normalized = Math.max(0, Math.min(1, (y + 1) / 2));
          colors.push([
            0.4 + normalized * 0.6,  // Rouge (plus clair en hauteur)
            0.4 + normalized * 0.6,  // Vert (plus clair en hauteur)
            0.5 + normalized * 0.5   // Bleu (plus clair en hauteur)
          ]);
        }
      }

      // Envoyer les données au composant parent
      if (onScanComplete) {
        onScanComplete({
          points,
          colors,
          faces: data.faces || []
        });
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
      scanCompleteListener.remove();
      errorListener.remove();
    };
  }, [deviceSupported, onScanProgress, onScanComplete]);

  // Réagir aux changements d'état de scan
  useEffect(() => {
    if (!deviceSupported || !isInitializedRef.current) return;

    const handleScanState = async () => {
      try {
        if (isScanning) {
          // Démarrer le scan
          console.log("Démarrage du scan de mesh");
          setStatusText('Scan en cours... Déplacez-vous lentement autour de l\'objet');
          setVertexCount(0);
          setFaceCount(0);
          scanStartTimeRef.current = Date.now();

          // Options de scan (rayon en mètres)
          await MeshScanner.startScan({
            radius: 2.0, // 2 mètres de rayon autour de la caméra
          });

          // Notifier DeviceEventEmitter pour compatibilité
          DeviceEventEmitter.emit('MESH_SCAN_STARTED');
        } else if (scanStartTimeRef.current) {
          // Arrêter le scan
          console.log("Arrêt du scan de mesh");
          setStatusText('Finalisation du scan...');

          const result = await MeshScanner.stopScan();
          console.log(`Scan terminé: ${result.count} vertices`);
          setStatusText('Scan terminé');

          // Notifier DeviceEventEmitter pour compatibilité
          DeviceEventEmitter.emit('MESH_SCAN_COMPLETED');

          scanStartTimeRef.current = null;
        }
      } catch (error) {
        console.error('Erreur lors du scan:', error);
        setStatusText(`Erreur: ${error.message || 'Erreur inconnue'}`);
      }
    };

    handleScanState();
  }, [isScanning, deviceSupported]);

  return (
    <View style={styles.container}>
      {/* Vous pouvez rendre l'interface de scan ici si nécessaire */}
      <Text style={styles.statusText}>{statusText}</Text>

      {isScanning && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Vertices: {vertexCount} | Faces: {faceCount}
          </Text>
          <Text style={styles.instructionText}>
            Déplacez-vous lentement autour de l'objet pour capturer tous les détails
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
  },
  progressText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 5,
  },
  instructionText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  }
});

export default SceneScanner;