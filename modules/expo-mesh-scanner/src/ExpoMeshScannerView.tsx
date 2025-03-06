// modules/expo-mesh-scanner/src/ExpoMeshScannerView.tsx
import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { ViewProps } from 'react-native';

export interface ExpoMeshScannerViewProps extends ViewProps {
  // Whether to use the current session
  session?: boolean;
}

// Get the native view manager
const NativeView = requireNativeViewManager('ExpoMeshScanner');

// Component that wraps the native view
export default function ExpoMeshScannerView(props: ExpoMeshScannerViewProps) {
  return <NativeView session={props.session ?? true} style={[{ flex: 1 }, props.style]} />;
}