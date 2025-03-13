import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to Test.web.ts
// and on native platforms to Test.ts
import TestModule from './src/TestModule';
import TestView from './src/TestView';
import { ChangeEventPayload, TestViewProps } from './src/Test.types';

// Get the native constant value.
export const PI = TestModule.PI;

export function hello(): string {
  return TestModule.hello();
}

export async function setValueAsync(value: string) {
  return await TestModule.setValueAsync(value);
}

const emitter = new EventEmitter(TestModule ?? NativeModulesProxy.Test);

export function addChangeListener(listener: (event: ChangeEventPayload) => void): Subscription {
  return emitter.addListener<ChangeEventPayload>('onChange', listener);
}

export { TestView, TestViewProps, ChangeEventPayload };
