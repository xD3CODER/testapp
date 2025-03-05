import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoMeshScannerViewProps } from './ExpoMeshScanner.types';

const NativeView: React.ComponentType<ExpoMeshScannerViewProps> =
  requireNativeView('ExpoMeshScanner');

export default function ExpoMeshScannerView(props: ExpoMeshScannerViewProps) {
  return <NativeView {...props} />;
}
