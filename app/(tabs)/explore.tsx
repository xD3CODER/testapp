import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, Text, StyleSheet, FlatList, Image } from 'react-native';
import ScanScreen from '@/components/ScanView';

interface ScannedModel {
  id: string;
  name: string;
  date: string;
  modelPath: string;
  previewPath: string;
}

export default function ExploreScreen() {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedModels, setScannedModels] = useState<ScannedModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<ScannedModel | null>(null);

  const handleScanComplete = (modelPath: string, previewPath: string) => {
    const newModel = {
      id: Date.now().toString(),
      name: `Scan ${scannedModels.length + 1}`,
      date: new Date().toLocaleDateString(),
      modelPath,
      previewPath
    };

    setScannedModels([newModel, ...scannedModels]);
    setShowScanner(false);

    // Optionnel : sélectionner automatiquement le nouveau modèle
    setSelectedModel(newModel);
  };

  const renderModelItem = ({ item }: { item: ScannedModel }) => (
    <TouchableOpacity
      style={styles.modelItem}
      onPress={() => setSelectedModel(item)}
    >
      {/* Si previewPath est une URL, vous pouvez essayer de l'afficher */}
      <View style={styles.previewContainer}>
        <Text style={styles.previewText}>Aperçu 3D</Text>
      </View>
      <View style={styles.modelInfo}>
        <Text style={styles.modelName}>{item.name}</Text>
        <Text style={styles.modelDate}>{item.date}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => setShowScanner(true)}>
        <Text style={styles.scanButtonText}>Démarrer un nouveau scan</Text>
      </TouchableOpacity>

      {/* Liste des modèles scannés */}
      {scannedModels.length > 0 ? (
        <FlatList
          data={scannedModels}
          keyExtractor={(item) => item.id}
          renderItem={renderModelItem}
          contentContainerStyle={styles.modelsList}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Aucun modèle 3D capturé pour le moment.
          </Text>
          <Text style={styles.emptyStateSubtext}>
            Appuyez sur le bouton ci-dessus pour scanner un objet.
          </Text>
        </View>
      )}

      {/* Modal du scanner */}
      <Modal
        visible={showScanner}
        animationType="slide"
        presentationStyle="fullScreen">
        <ScanScreen
          onComplete={handleScanComplete}
          onCancel={() => setShowScanner(false)}
        />
      </Modal>

      {/* Modal pour afficher le modèle sélectionné (à implémenter) */}
      <Modal
        visible={!!selectedModel}
        animationType="slide"
        onRequestClose={() => setSelectedModel(null)}
      >
        <View style={styles.modelViewerContainer}>
          <View style={styles.modelViewerHeader}>
            <Text style={styles.modelViewerTitle}>
              {selectedModel?.name}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedModel(null)}
            >
              <Text style={styles.closeButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>

          {/* Ici, vous pourriez intégrer un visualiseur 3D pour le modèle */}
          <View style={styles.modelViewerContent}>
            <Text style={styles.modelPath}>
              Chemin du modèle: {selectedModel?.modelPath}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20
  },
  scanButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    marginVertical: 20
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold'
  },
  modelsList: {
    paddingBottom: 20
  },
  modelItem: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginVertical: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  previewContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  previewText: {
    color: '#757575',
    fontSize: 12
  },
  modelInfo: {
    flex: 1,
    padding: 15,
    justifyContent: 'center'
  },
  modelName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5
  },
  modelDate: {
    fontSize: 14,
    color: '#757575'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center'
  },
  modelViewerContainer: {
    flex: 1,
    backgroundColor: 'white'
  },
  modelViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  modelViewerTitle: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  closeButton: {
    padding: 8
  },
  closeButtonText: {
    color: '#2196F3',
    fontSize: 16
  },
  modelViewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modelPath: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center'
  }
});