// ExpoMeshScannerView.tsx
import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { ViewProps } from 'react-native';

export interface ExpoMeshScannerViewProps extends ViewProps {
  session?: boolean;
}

// Obtenir le gestionnaire de vue natif
const NativeView = requireNativeViewManager('ExpoMeshScanner');

// Composant qui enveloppe la vue native
export default function ExpoMeshScannerView(props: ExpoMeshScannerViewProps) {
  return <NativeView session={props.session ?? true} style={[{ flex: 1 }, props.style]} />;
}