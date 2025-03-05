import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './ExpoMeshScanner.types';

type ExpoMeshScannerModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class ExpoMeshScannerModule extends NativeModule<ExpoMeshScannerModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(ExpoMeshScannerModule);
