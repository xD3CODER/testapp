import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';

import { TestViewProps } from './Test.types';

const NativeView: React.ComponentType<TestViewProps> =
  requireNativeViewManager('Test');

export default function TestView(props: TestViewProps) {
  return <NativeView {...props} />;
}
