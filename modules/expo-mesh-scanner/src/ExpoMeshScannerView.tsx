// src/ExpoMeshScannerView.tsx
import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { ViewProps } from 'react-native';

export interface ExpoMeshScannerViewProps extends ViewProps {
  // Props pour initialiser la vue AR
  initialize?: boolean;
  isScanning?: boolean;

  // Props pour la visualisation
  showMesh?: boolean;
  showGuides?: boolean;
  showCapturedImages?: boolean;

  // Props pour la sélection d'objet
  targetObject?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Callbacks pour les événements
  onInitialized?: (event: { nativeEvent: any }) => void;
  onTouch?: (event: { nativeEvent: { x: number, y: number, rawX: number, rawY: number } }) => void;
  onTrackingStateChanged?: (event: { nativeEvent: { state: string } }) => void;
}

const NativeView: React.ComponentType<ExpoMeshScannerViewProps> =
  requireNativeViewManager('ExpoMeshScanner');

export default function ExpoMeshScannerView(props: ExpoMeshScannerViewProps) {
  // Passez simplement les props directement au composant natif
  return (
    <NativeView
      initialize={props.initialize}
      isScanning={props.isScanning}
      showMesh={props.showMesh}
      showGuides={props.showGuides}
      showCapturedImages={props.showCapturedImages}
      targetObject={props.targetObject}
      onInitialized={props.onInitialized}
      onTouch={props.onTouch}
      onTrackingStateChanged={props.onTrackingStateChanged}
      style={props.style}
      {...props}
    />
  );
}