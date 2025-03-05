import * as React from 'react';

import { ExpoMeshScannerViewProps } from './ExpoMeshScanner.types';

export default function ExpoMeshScannerView(props: ExpoMeshScannerViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
