
#import "ExpoMeshScannerModule.h"
#import <Metal/Metal.h>

@implementation ExpoMeshScannerModule

// Define the module name for JavaScript
EX_EXPORT_MODULE(ExpoMeshScanner);

// Define the events that this module can emit
- (NSArray<NSString *> *)eventNames {
  return @[@"onMeshUpdated", @"onScanComplete", @"onScanError"];
}

// Initialisation
- (instancetype)init {
  if (self = [super init]) {
    _isScanning = NO;
    _meshVertices = [NSMutableArray new];
    _meshFaces = [NSMutableArray new];
    _scanRadius = 1.0; // 1 mètre par défaut
    _lastUpdateTime = 0;
  }
  return self;
}

// Vérification si l'appareil supporte ARKit et le mesh
EX_EXPORT_METHOD_AS(checkSupport,
                   checkSupport:(EXPromiseResolveBlock)resolve
                   reject:(EXPromiseRejectBlock)reject) {
  if (@available(iOS 13.4, *)) {
    BOOL isSupported = [ARWorldTrackingConfiguration supportsSceneReconstruction:ARSceneReconstructionMesh];
    if (isSupported) {
      resolve(@{@"supported": @YES, @"hasLiDAR": @YES});
    } else {
      resolve(@{@"supported": @NO, @"hasLiDAR": @NO, @"reason": @"Device does not support scene reconstruction"});
    }
  } else {
    resolve(@{@"supported": @NO, @"hasLiDAR": @NO, @"reason": @"iOS version does not support scene reconstruction"});
  }
}

// Démarrer le scan
EX_EXPORT_METHOD_AS(startScan,
                   startScan:(NSDictionary *)options
                   resolve:(EXPromiseResolveBlock)resolve
                   reject:(EXPromiseRejectBlock)reject) {
  if (_isScanning) {
    reject(@"already_scanning", @"A scan is already in progress", nil);
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    // Extraire les options
    if (options[@"radius"]) {
      self.scanRadius = [options[@"radius"] floatValue];
    }

    // Réinitialiser les données de scan
    [self.meshVertices removeAllObjects];
    [self.meshFaces removeAllObjects];

    // Configurer ARKit
    if (@available(iOS 13.4, *)) {
      self.session = [ARSession new];
      self.session.delegate = self;
      self.configuration = [ARWorldTrackingConfiguration new];

      // Activer la reconstruction de mesh
      if ([ARWorldTrackingConfiguration supportsSceneReconstruction:ARSceneReconstructionMesh]) {
        self.configuration.sceneReconstruction = ARSceneReconstructionMesh;
        self.configuration.environmentTexturing = AREnvironmentTexturingAutomatic;

        // Configurer le suivi
        self.configuration.planeDetection = ARPlaneDetectionHorizontal | ARPlaneDetectionVertical;
        
        // Configurer les sémantiques de frame si disponibles
        if ([ARWorldTrackingConfiguration instancesRespondToSelector:@selector(setFrameSemantics:)]) {
          self.configuration.frameSemantics = ARFrameSemanticSceneDepth | ARFrameSemanticSmoothedSceneDepth;
        }

        [self.session runWithConfiguration:self.configuration];
        self.isScanning = YES;
        resolve(@{@"success": @YES});
      } else {
        reject(@"mesh_not_supported", @"This device does not support scene reconstruction", nil);
      }
    } else {
      reject(@"ios_version", @"iOS version does not support scene reconstruction", nil);
    }
  });
}

// Arrêter le scan et récupérer le mesh
EX_EXPORT_METHOD_AS(stopScan,
                   stopScan:(EXPromiseResolveBlock)resolve
                   reject:(EXPromiseRejectBlock)reject) {
  if (!_isScanning) {
    reject(@"not_scanning", @"No scan is in progress", nil);
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    if (@available(iOS 13.4, *)) {
      // Extraire le mesh final
      [self extractMeshData];

      // Arrêter la session
      [self.session pause];
      self.isScanning = NO;

      // Préparer les données de retour
      NSDictionary *meshData = @{
        @"vertices": self.meshVertices,
        @"faces": self.meshFaces,
        @"count": @(self.meshVertices.count / 3),
      };

      // Envoyer les données complètes
      [self sendEventWithName:@"onScanComplete" body:meshData];
      resolve(meshData);
    } else {
      reject(@"ios_version", @"iOS version does not support scene reconstruction", nil);
    }
  });
}


// Délégué de session ARKit
- (void)session:(ARSession *)session didUpdateFrame:(ARFrame *)frame {
  if (!_isScanning) return;

  // Limiter la fréquence des mises à jour (toutes les 500ms)
  NSInteger currentTime = (NSInteger)([[NSDate date] timeIntervalSince1970] * 1000);
  if (currentTime - _lastUpdateTime < 500) return;
  _lastUpdateTime = currentTime;

  if (@available(iOS 13.4, *)) {
    [self extractMeshData];

    // Envoyer une mise à jour de progression
    NSDictionary *updateData = @{
      @"vertices": @(self.meshVertices.count / 3),
      @"faces": @(self.meshFaces.count / 3)
    };
    [self sendEventWithName:@"onMeshUpdated" body:updateData];
  }
}


// Correction de la méthode extractMeshData
// Méthode extractMeshData avec l'API ARKit correcte

// Extraction des données de mesh
- (void)extractMeshData API_AVAILABLE(ios(13.4)) {
  // Réinitialiser les données
  [self.meshVertices removeAllObjects];
  [self.meshFaces removeAllObjects];
  
  // Parcourir tous les anchors de mesh
  for (ARAnchor *anchor in self.session.currentFrame.anchors) {
    if (![anchor isKindOfClass:[ARMeshAnchor class]]) continue;
    
    ARMeshAnchor *meshAnchor = (ARMeshAnchor *)anchor;
    ARGeometrySource *vertices = meshAnchor.geometry.vertices;
    ARGeometryElement *faces = meshAnchor.geometry.faces;
    
    // Accéder aux données des vertices
    NSData *vertexBuffer = [vertices buffer];
    const float *vertexData = (const float *)[vertexBuffer bytes];
    NSInteger vertexCount = vertices.count;
    NSInteger componentsPerVertex = vertices.componentsPerVector;
    NSInteger stride = vertices.stride / sizeof(float);
    
    // Transformer et extraire les vertices
    for (NSInteger vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
      // Calculer l'index dans le buffer
      NSInteger dataIndex = vertexIndex * stride;
      
      // Lire les composants du vertex
      float x = vertexData[dataIndex];
      float y = vertexData[dataIndex + 1];
      float z = vertexData[dataIndex + 2];
      
      // Créer un vecteur 3D
      vector_float3 vertex = (vector_float3){x, y, z};
      
      // Appliquer la transformation
      simd_float4 transformedVertex = simd_mul(meshAnchor.transform, simd_make_float4(vertex, 1.0));
      
      // Vérifier si le point est dans le rayon de scan
      float distance = sqrtf(powf(transformedVertex.x, 2) + powf(transformedVertex.z, 2));
      if (distance <= self.scanRadius) {
        [self.meshVertices addObject:@(transformedVertex.x)];
        [self.meshVertices addObject:@(transformedVertex.y)];
        [self.meshVertices addObject:@(transformedVertex.z)];
      }
    }
    
    // Accéder aux indices des faces
    NSData *indexBuffer = [faces buffer];
    NSInteger indexCount = faces.count;
    NSInteger indicesPerFace = faces.indexCountPerPrimitive;
    
    // Extraire les indices selon le format (16-bit ou 32-bit)
    if (faces.bytesPerIndex == sizeof(uint16_t)) {
      // Indices 16-bit
      const uint16_t *indexData = (const uint16_t *)[indexBuffer bytes];
      
      // Pour chaque triangle
      for (NSInteger faceIndex = 0; faceIndex < indexCount; faceIndex++) {
        for (NSInteger i = 0; i < indicesPerFace; i++) {
          [self.meshFaces addObject:@(indexData[faceIndex * indicesPerFace + i])];
        }
      }
    } else if (faces.bytesPerIndex == sizeof(uint32_t)) {
      // Indices 32-bit
      const uint32_t *indexData = (const uint32_t *)[indexBuffer bytes];
      
      // Pour chaque triangle
      for (NSInteger faceIndex = 0; faceIndex < indexCount; faceIndex++) {
        for (NSInteger i = 0; i < indicesPerFace; i++) {
          [self.meshFaces addObject:@(indexData[faceIndex * indicesPerFace + i])];
        }
      }
    } else {
      NSLog(@"Format d'indices non supporté: %lu bytes", (unsigned long)faces.bytesPerIndex);
    }
  }
  
  NSLog(@"Mesh data extracted: %lu vertices, %lu face indices",
        (unsigned long)self.meshVertices.count / 3,
        (unsigned long)self.meshFaces.count / 3);
}

@end
