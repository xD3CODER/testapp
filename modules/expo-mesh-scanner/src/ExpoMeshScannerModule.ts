import { NativeModule, requireNativeModule } from 'expo';

import { ExpoMeshScannerModuleEvents } from './ExpoMeshScanner.types';

declare class ExpoMeshScannerModule extends NativeModule<ExpoMeshScannerModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoMeshScannerModule>('ExpoMeshScanner');
