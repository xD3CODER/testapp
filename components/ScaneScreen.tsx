import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
  Alert,
  SafeAreaView
} from 'react-native';
import ScanView from '../components/ScanView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const ScanScreen = () => {
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [scannedModel, setScannedModel] = useState<{
    modelPath: string;
    previewPath: string;
  } | null>(null);

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
    setScannedModel({ modelPath, previewPath });
    setIsScanningActive(false);
  };

  const handleScanClose = () => {
    setIsScanningActive(false);
  };

  const handleShareModel = () => {
    if (!scannedModel) return;

    // Share model implementation would go here
    Alert.alert(
      'Model Sharing',
      'This would open the share dialog for your 3D model.',
      [{ text: 'OK' }]
    );
  };

  const handleViewModel = () => {
    if (!scannedModel) return;

    // View model implementation would go here
    Alert.alert(
      'View Model',
      'This would open a 3D viewer for your model.',
      [{ text: 'OK' }]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>3D Object Scanner</ThemedText>

      {scannedModel ? (
        <View style={styles.resultContainer}>
          <ThemedText type="subtitle">Scan Complete!</ThemedText>

          <Image
            source={{ uri: `file://${scannedModel.previewPath}` }}
            style={styles.previewImage}
            resizeMode="contain"
          />

          <ThemedText>Your 3D model is ready</ThemedText>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={handleViewModel}>
              <ThemedText style={styles.buttonText}>View Model</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleShareModel}>
              <ThemedText style={styles.buttonText}>Share</ThemedText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setScannedModel(null)}>
            <ThemedText style={styles.secondaryButtonText}>New Scan</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.startContainer}>
          <View style={styles.infoCard}>
            <ThemedText type="subtitle">3D Scanning</ThemedText>
            <ThemedText style={styles.infoText}>
              Create detailed 3D models of objects using your device's camera.
            </ThemedText>

            <View style={styles.instructionsContainer}>
              <ThemedText type="defaultSemiBold">Tips:</ThemedText>
              <ThemedText>• Ensure good lighting conditions</ThemedText>
              <ThemedText>• Capture object from all angles</ThemedText>
              <ThemedText>• Keep the object centered</ThemedText>
              <ThemedText>• Avoid reflective or transparent objects</ThemedText>
            </View>
          </View>

          <TouchableOpacity style={styles.startButton} onPress={startScan}>
            <ThemedText style={styles.startButtonText}>Start 3D Scan</ThemedText>
          </TouchableOpacity>
        </View>
      )}

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
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  startContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  infoCard: {
    padding: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginBottom: 20,
  },
  infoText: {
    marginVertical: 10,
  },
  instructionsContainer: {
    marginTop: 15,
  },
  startButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: 300,
    marginVertical: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 140,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  secondaryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  secondaryButtonText: {
    color: '#2196F3',
  },
});

export default ScanScreen;