import ExpoModulesCore
import RealityKit
import SwiftUI

public class ExpoObjectQuickView: ExpoView {
    private var hostingController: UIHostingController<AnyView>?
    static var currentInstance: ExpoObjectQuickView?

    // Propriété pour le chemin du fichier
    var filePath: String = "" {
        didSet {
            updateView()
        }
    }

    let onViewReady = EventDispatcher()

    required public init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        ExpoObjectQuickView.currentInstance = self
        setupInitialView()
    }

    private func setupInitialView() {
        let initialView = UIHostingController(rootView:
            AnyView(
                ZStack {
                    Color.black.edgesIgnoringSafeArea(.all)
                    Text("En attente du fichier...")
                        .foregroundColor(.white)
                        .font(.headline)
                }
            )
        )

        initialView.view.frame = bounds
        initialView.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(initialView.view)
        hostingController = initialView
    }

    private func updateView() {
        guard !filePath.isEmpty else { return }

        let url = URL(fileURLWithPath: filePath)
        let quickLookView = UIHostingController(rootView:
            AnyView(
                ModelView(modelFile: url, endCaptureCallback: {
                    // Action de fin, optionnelle
                })
            )
        )

        // Remplacer la vue existante
        hostingController?.view.removeFromSuperview()
        quickLookView.view.frame = bounds
        quickLookView.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(quickLookView.view)
        hostingController = quickLookView
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        hostingController?.view.frame = bounds
    }
}