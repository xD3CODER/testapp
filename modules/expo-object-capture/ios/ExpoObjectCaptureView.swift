import ExpoModulesCore
import RealityKit
import SwiftUI
public class ExpoObjectCaptureView: ExpoView {
    private var hostingController: UIHostingController<AnyView>?
    private var currentSession: ObjectCaptureSession?

    let onViewReady = EventDispatcher()

    required public init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupInitialView()
    }

    private func setupInitialView() {
        let initialView = UIHostingController(rootView:
            AnyView(
                ZStack {
                    Color.black.edgesIgnoringSafeArea(.all)
                    Text("En attente de la session de capture...")
                        .foregroundColor(.white)
                        .font(.headline)
                }
            )
        )

        initialView.view.frame = bounds
        initialView.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(initialView.view)
        hostingController = initialView

        // Signaler que la vue est prête
        DispatchQueue.main.async {
            self.onViewReady([:])
        }
    }
public func setReconstructionView() {
    print("SETTING RECONSTRUCTION VIEW")
    hostingController?.view.removeFromSuperview()

    guard let captureFolderManager = AppDataModel.instance.captureFolderManager else {
        print("ERROR: Capture folder manager is nil")
        return
    }

    // Important: Mettre à jour l'état avant de créer la vue
    AppDataModel.instance.state = .prepareToReconstruct

    let outputFile = captureFolderManager.modelsFolder.appendingPathComponent("model-mobile.usdz")

    let captureView = UIHostingController(rootView:
        AnyView(
            ReconstructionPrimaryView(outputFile: outputFile)
                .environment(AppDataModel.instance)
        )
    )

    captureView.view.frame = bounds
    captureView.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(captureView.view)
    hostingController = captureView
}
    public func setSession(_ session: ObjectCaptureSession?) {
        guard let session = session, #available(iOS 18.0, *) else { return }

        currentSession = session

        // Vue combinée unique, enveloppée dans AnyView
        let captureView = UIHostingController(rootView:
            AnyView(
                ZStack {
                    ObjectCaptureView(session: session)
                        .hideObjectReticle(true)
                }
                .edgesIgnoringSafeArea(.all)
                .environment(AppDataModel.instance)
            )
        )

        // Remplacer la vue existante
        hostingController?.view.removeFromSuperview()
        captureView.view.frame = bounds
        captureView.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(captureView.view)
        hostingController = captureView
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        hostingController?.view.frame = bounds
    }
}
