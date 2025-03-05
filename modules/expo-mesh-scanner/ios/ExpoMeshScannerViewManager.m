#import "ExpoMeshScannerViewManager.h"
#import <ARKit/ARKit.h>
#import <React/RCTUIManager.h>

@interface ExpoMeshScannerView : UIView
@property (nonatomic, strong) ARSCNView *arView;
@end

@implementation ExpoMeshScannerView

- (instancetype)init {
  self = [super init];
  if (self) {
    _arView = [[ARSCNView alloc] init];
    [self addSubview:_arView];
  }
  return self;
}

- (void)layoutSubviews {
  [super layoutSubviews];
  _arView.frame = self.bounds;
}

@end

@implementation ExpoMeshScannerViewManager

RCT_EXPORT_MODULE(ExpoMeshScannerView)

- (UIView *)view {
  return [[ExpoMeshScannerView alloc] init];
}

@end