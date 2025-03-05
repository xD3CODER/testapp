#import <ExpoModulesCore/ExpoModulesCore.h>
#import <ARKit/ARKit.h>

@interface ExpoMeshScannerModule : ExpoModule <ARSessionDelegate>

@property (nonatomic, strong) ARSession *session;
@property (nonatomic, strong) ARWorldTrackingConfiguration *configuration;
@property (nonatomic, assign) BOOL isScanning;
@property (nonatomic, strong) NSMutableArray *meshVertices;
@property (nonatomic, strong) NSMutableArray *meshFaces;
@property (nonatomic, assign) float scanRadius;
@property (nonatomic, assign) NSInteger lastUpdateTime;

@end
