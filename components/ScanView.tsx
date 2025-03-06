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
} from 'react-native';

import MeshScanner from '../modules/expo-mesh-scanner/src/ExpoMeshScannerModule';
import ExpoMeshScannerView from '../modules/expo-mesh-scanner/src/ExpoMeshScannerView';

interface ScanViewProps {
  onScanComplete?: (modelPath: string, previewPath: string) => void;
  onClose?: () => void;
}

const ScanView: React.FC<ScanViewProps> = ({ onScanComplete, onClose }) => {
  // State
  const [deviceSupported, setDeviceSupported] = useState<boolean>(false);
  const [currentState, setCurrentState] = useState<string>('notStarted');
  const [feedback, setFeedback] = useState<string>('');
  const [scanCompleted, setScanCompleted] = useState<boolean>(false);
  const [reconstructing, setReconstructing] = useState<boolean>(false);
  const [reconstructionProgress, setReconstructionProgress] = useState<number>(0);
  const [reconstructionStage, setReconstructionStage] = useState<string>('');

  // Check device support on mount
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
  }, [onClose]);

  // Set up event listeners
  useEffect(() => {
    if (!deviceSupported) return;

    const stateChangedListener = MeshScanner.onScanStateChanged((event) => {
      setCurrentState(event.state);

      // Auto-transition for testing (remove in production)
      if (event.state === 'ready') {
        setTimeout(() => {
          MeshScanner.startDetecting().catch(console.error);
        }, 1000);
      }
    });

    const progressListener = MeshScanner.onScanProgressUpdate((event) => {
      setFeedback(event.feedback);
    });

    const completeListener = MeshScanner.onScanComplete(() => {
      setScanCompleted(true);
    });

    const reconstructionProgressListener = MeshScanner.onReconstructionProgress((event) => {
      setReconstructionProgress(event.progress);
      setReconstructionStage(event.stage);
    });

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

    const errorListener = MeshScanner.onScanError((event) => {
      Alert.alert('Error', event.message);
    });

    // Start scan immediately
    MeshScanner.startScan({
      enableOverCapture: true,
      highQualityMode: false
    }).catch(error => {
      console.error('Failed to start scan:', error);
      Alert.alert('Error', 'Failed to start scanning session');
    });

    // Cleanup
    return () => {
      stateChangedListener.remove();
      progressListener.remove();
      completeListener.remove();
      reconstructionProgressListener.remove();
      reconstructionCompleteListener.remove();
      errorListener.remove();
      MeshScanner.removeAllListeners();
    };
  }, [deviceSupported, onScanComplete]);

  // Start the scanning process
  const handleStartDetecting = async () => {
    try {
      await MeshScanner.startDetecting();
    } catch (error) {
      console.error('Failed to start detecting:', error);
    }
  };

  // Start capturing after object detection
  const handleStartCapturing = async () => {
    try {
      await MeshScanner.startCapturing();
    } catch (error) {
      console.error('Failed to start capturing:', error);
    }
  };

  // Finish the scan
  const handleFinishScan = async () => {
    try {
      await MeshScanner.finishScan();
    } catch (error) {
      console.error('Failed to finish scan:', error);
    }
  };

  // Cancel current scan
  const handleCancelScan = async () => {
    try {
      await MeshScanner.cancelScan();
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to cancel scan:', error);
    }
  };

  // Start 3D model reconstruction
  const handleReconstruct = async () => {
    try {
      setReconstructing(true);
      await MeshScanner.reconstructModel({
        detailLevel: 'medium'
      });
    } catch (error) {
      setReconstructing(false);
      console.error('Failed to reconstruct model:', error);
      Alert.alert('Error', 'Failed to create 3D model');
    }
  };

  // Render controls based on current state
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
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelScan}>
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
              Position your device to scan the object
            </Text>
            <TouchableOpacity style={styles.button} onPress={handleStartDetecting}>
              <Text style={styles.buttonText}>Start Detecting</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelScan}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'detecting':
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.stateText}>Detecting object</Text>
            <Text style={styles.feedbackText}>{feedback}</Text>
            <TouchableOpacity style={styles.button} onPress={handleStartCapturing}>
              <Text style={styles.buttonText}>Start Capturing</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelScan}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'capturing':
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.stateText}>Capturing...</Text>
            <Text style={styles.feedbackText}>{feedback}</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelScan}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'completed':
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.stateText}>Scan Completed</Text>
            <Text style={styles.feedbackText}>
              Review your scan and create a 3D model
            </Text>
            <TouchableOpacity style={styles.button} onPress={handleFinishScan}>
              <Text style={styles.buttonText}>Finish</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelScan}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

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
            <TouchableOpacity style={styles.button} onPress={handleReconstruct}>
              <Text style={styles.buttonText}>Create 3D Model</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelScan}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        );

      case 'error':
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.errorText}>An error occurred</Text>
            <TouchableOpacity style={styles.button} onPress={handleCancelScan}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return (
          <View style={styles.controlsContainer}>
            <Text style={styles.stateText}>State: {currentState}</Text>
            <Text style={styles.feedbackText}>{feedback}</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelScan}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  if (Platform.OS !== 'ios' || parseInt(Platform.Version.toString(), 10) < 17) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.incompatibleContainer}>
          <Text style={styles.errorText}>
            3D Scanning requires iOS 17 or later
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
      {/* Main scanner view */}
      <View style={styles.scannerContainer}>
        <ExpoMeshScannerView style={styles.scanner} />
      </View>

      {/* Controls overlay */}
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
});

export default ScanView;