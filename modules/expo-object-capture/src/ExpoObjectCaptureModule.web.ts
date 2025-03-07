import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './ExpoObjectCapture.types';

type ExpoObjectCaptureModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class ExpoObjectCaptureModule extends NativeModule<ExpoObjectCaptureModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(ExpoObjectCaptureModule);
