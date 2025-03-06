import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, Platform, Alert, Modal } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Collapsible } from '@/components/Collapsible';
import { ExternalLink } from '@/components/ExternalLink';
import ScanView from '@/components/ScanView';

export default function ExploreScreen() {
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [scannedModels, setScannedModels] = useState<
    Array<{
      id: string;
      name: string;
      date: string;
      modelPath: string;
      previewPath: string;
    }>
  >([]);

  const startScan = () => {
    if (Platform.OS !== 'ios' || parseInt(Platform.Version.toString(), 10) < 17) {
      Alert.alert(
        'Device Not Supported',
        '3D Scanning requires an iOS device with iOS 17 or later.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsScanningActive(true);
  };

  const handleScanComplete = (modelPath: string, previewPath: string) => {
    // Add the new model to our collection
    const newModel = {
      id: Date.now().toString(),
      name: `Scan ${scannedModels.length + 1}`,
      date: new Date().toLocaleDateString(),
      modelPath,
      previewPath,
    };

    setScannedModels([newModel, ...scannedModels]);
    setIsScanningActive(false);
  };

  const handleScanClose = () => {
    setIsScanningActive(false);
  };

  return (
    <ScrollView>
      <ThemedView style={styles.container}>
        <ThemedText type="title">Explore</ThemedText>

        {/* 3D Scanning Feature */}
        <ThemedView style={styles.featureCard}>
          <ThemedText type="subtitle">3D Object Scanner</ThemedText>
          <ThemedText style={styles.featureDescription}>
            Create detailed 3D models using the device's camera. Capture objects from multiple angles and convert them into 3D models.
          </ThemedText>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={startScan}
          >
            <ThemedText style={styles.scanButtonText}>Start New Scan</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Previously Scanned Models */}
        {scannedModels.length > 0 && (
          <>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Your 3D Models</ThemedText>

            {scannedModels.map(model => (
              <ThemedView key={model.id} style={styles.modelCard}>
                <Image
                  source={{ uri: `file://${model.previewPath}` }}
                  style={styles.modelPreview}
                  resizeMode="cover"
                />

                <View style={styles.modelInfo}>
                  <ThemedText type="defaultSemiBold">{model.name}</ThemedText>
                  <ThemedText>{model.date}</ThemedText>

                  <View style={styles.modelButtons}>
                    <TouchableOpacity
                      style={styles.modelButton}
                      onPress={() => {
                        Alert.alert('View Model', 'Viewing 3D model: ' + model.name);
                      }}
                    >
                      <ThemedText style={styles.modelButtonText}>View</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modelButton}
                      onPress={() => {
                        Alert.alert('Share Model', 'Sharing 3D model: ' + model.name);
                      }}
                    >
                      <ThemedText style={styles.modelButtonText}>Share</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              </ThemedView>
            ))}
          </>
        )}

        {/* More Info */}
        <Collapsible title="About 3D Scanning">
          <ThemedText>
            This app uses Apple's Object Capture API to create detailed 3D models from photos.
            The technology uses photogrammetry to analyze images and construct a 3D representation.
          </ThemedText>

          <ThemedView style={styles.infoBox}>
            <ThemedText type="defaultSemiBold">Tips for best results:</ThemedText>
            <ThemedText>• Ensure good, even lighting</ThemedText>
            <ThemedText>• Capture from all angles</ThemedText>
            <ThemedText>• Use a contrasting background</ThemedText>
            <ThemedText>• Avoid reflective or transparent objects</ThemedText>
            <ThemedText>• Keep the object centered in frame</ThemedText>
          </ThemedView>

          <ExternalLink href="https://developer.apple.com/augmented-reality/object-capture/">
            <ThemedText type="link">Learn more about Object Capture</ThemedText>
          </ExternalLink>
        </Collapsible>

        <Collapsible title="Technical Information">
          <ThemedText>
            This 3D scanning feature uses RealityKit and Object Capture API introduced in iOS 17.
            It creates USDZ models that are compatible with AR Quick Look and other 3D viewers.
          </ThemedText>

          <ThemedText style={{marginTop: 10}}>
            The scanning process has multiple steps:
          </ThemedText>

          <ThemedView style={styles.infoBox}>
            <ThemedText>1. Object detection</ThemedText>
            <ThemedText>2. Image capture from multiple angles</ThemedText>
            <ThemedText>3. Photogrammetric processing</ThemedText>
            <ThemedText>4. 3D model generation with textures</ThemedText>
          </ThemedView>
        </Collapsible>
      </ThemedView>

      {/* Full-screen modal for scanning */}
      <Modal
        visible={isScanningActive}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <ScanView
          onScanComplete={handleScanComplete}
          onClose={handleScanClose}
        />
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  featureCard: {
    padding: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    marginVertical: 10,
  },
  featureDescription: {
    marginVertical: 10,
  },
  scanButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 10,
    alignItems: 'center',
  },
  scanButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
  },
  modelCard: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  modelPreview: {
    width: 100,
    height: 100,
  },
  modelInfo: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  modelButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  modelButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 15,
    marginLeft: 10,
  },
  modelButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
  },
});