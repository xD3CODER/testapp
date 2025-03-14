import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { ViewProps } from 'react-native';

// Interface pour les props de la vue
export interface ObjectCaptureViewProps extends ViewProps {}

// Obtenir la vue native
const NativeObjectCaptureView = requireNativeViewManager('ExpoObjectCapture');

// Composant React
export function ObjectCaptureView(props: ObjectCaptureViewProps) {
  return <NativeObjectCaptureView {...props} />;
}

const NativeQuickView = requireNativeViewManager('ExpoObjectQuick');


export function ObjectQuickView(props: ObjectCaptureViewProps) {
  return <NativeQuickView {...props} />;
}