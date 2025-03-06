import ExpoModulesCore
import RealityKit
import SwiftUI
import UIKit

// SwiftUI wrapper for the Object Capture view
@available(iOS 17.0, *)
struct ObjectCaptureWrapper: UIViewControllerRepresentable {
    let session: ObjectCaptureSession
    
    func makeUIViewController(context: Context) -> UIViewController {
        let objectCaptureView = ObjectCaptureView(session: session)
        let hostingController = UIHostingController(rootView: objectCaptureView)
        return hostingController
    }
    
    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        // Nothing to update
    }
}

// SwiftUI wrapper for the point cloud preview
@available(iOS 17.0, *)
struct PointCloudWrapper: UIViewControllerRepresentable {
    let session: ObjectCaptureSession
    
    func makeUIViewController(context: Context) -> UIViewController {
        let pointCloudView = ObjectCapturePointCloudView(session: session)
        let hostingController = UIHostingController(rootView: pointCloudView)
        return hostingController
    }
    
    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        // Nothing to update
    }
}

// Main view class for Expo
public class ExpoMeshScannerView: ExpoView {
    private var session: ObjectCaptureSession?
    private var containerView: UIView = UIView()
    private var currentViewController: UIViewController?
    
    required public init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        self.setupView()
    }
    
    private func setupView() {
        containerView.frame = bounds
        containerView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(containerView)
    }
    
    @available(iOS 17.0, *)
    public func setSession(_ session: ObjectCaptureSession) {
        self.session = session
        self.updateView()
    }
    
    public func updateView() {
        guard let session = self.session else { return }
        
        if #available(iOS 17.0, *) {
            DispatchQueue.main.async {
                // Clean up existing view controller
                self.currentViewController?.willMove(toParent: nil)
                self.currentViewController?.view.removeFromSuperview()
                self.currentViewController?.removeFromParent()
                
                // Create the appropriate view based on scan state
                let rootViewController = UIApplication.shared.windows.first?.rootViewController
                
                if session.userCompletedScanPass {
                    // Show point cloud view after scan is complete
                    let pointCloudVC = UIHostingController(rootView: PointCloudWrapper(session: session))
                    rootViewController?.addChild(pointCloudVC)
                    
                    pointCloudVC.view.frame = self.containerView.bounds
                    pointCloudVC.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
                    self.containerView.addSubview(pointCloudVC.view)
                    pointCloudVC.didMove(toParent: rootViewController)
                    
                    self.currentViewController = pointCloudVC
                } else {
                    // Show main capture view during scanning
                    let captureVC = UIHostingController(rootView: ObjectCaptureWrapper(session: session))
                    rootViewController?.addChild(captureVC)
                    
                    captureVC.view.frame = self.containerView.bounds
                    captureVC.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
                    self.containerView.addSubview(captureVC.view)
                    captureVC.didMove(toParent: rootViewController)
                    
                    self.currentViewController = captureVC
                }
            }
        }
    }
    
    public override func layoutSubviews() {
        super.layoutSubviews()
        containerView.frame = bounds
        currentViewController?.view.frame = containerView.bounds
    }
}
