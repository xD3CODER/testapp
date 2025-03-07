import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { ViewProps } from 'react-native';

// Interface pour les props de la vue
export interface ExpoObjectCaptureViewProps extends ViewProps {}

// Obtenir la vue native
const NativeExpoObjectCaptureView = requireNativeViewManager('ExpoObjectCapture');

// Composant React
export default function ExpoObjectCaptureView(props: ExpoObjectCaptureViewProps) {
  return <NativeExpoObjectCaptureView {...props} />;
}