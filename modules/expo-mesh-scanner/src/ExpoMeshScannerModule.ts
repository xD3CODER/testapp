// src/ExpoMeshScannerModule.ts

import { requireNativeModule } from 'expo-modules-core';

// Interface pour les données d'événements
export interface MeshUpdateEvent {
  vertices: number;
  faces: number;
  images: number;
  currentAngle: number;
}

export interface ImageCapturedEvent {
  count: number;
  angle: number;
}

export interface GuidanceUpdateEvent {
  currentAngle: number;
  imagesRemaining: number;
  progress: number;
}

export interface MeshData {
  vertices: number[];
  faces: number[];
  count: number;
}

export interface ImageData {
  uri: string;
  timestamp: number;
  transform: number[];
}

export interface MeshCompleteEvent {
  mesh: MeshData;
  images: ImageData[];
  targetObject: { x: number, y: number, width: number, height: number } | null;
}

export interface SupportInfoEvent {
  supported: boolean;
  hasLiDAR: boolean;
  hasCamera: boolean;
  reason?: string;
}

export type CaptureMode = 'manual' | 'auto' | 'guided';

export interface ScanOptions {
  radius?: number;
  captureMode?: CaptureMode;
  captureInterval?: number;
  angleIncrement?: number;
  maxImages?: number;
  targetObject?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Nouvelles interfaces pour la reconstruction 3D
export interface ReconstructionProgressEvent {
  progress: number;
  stage: string;
}

export interface TextureData {
  uri: string;
}

export interface ModelData {
  vertices: number[];
  normals: number[];
  uvs: number[];
  faces: number[];
  texture: TextureData | null;
}

export interface ReconstructionCompleteEvent {
  success: boolean;
  model?: ModelData;
  boundingBox?: {
    min: [number, number, number];
    max: [number, number, number];
  };
  error?: string;
}

// Récupérer le module natif
const ExpoMeshScannerModule = requireNativeModule('ExpoMeshScanner');

export default ExpoMeshScannerModule;