import ExpoModulesCore
import RealityKit
import SwiftUI
import UIKit

// SwiftUI wrapper for the Object Capture view
@available(iOS 17.0, *)
struct ObjectCaptureWrapper: UIViewControllerRepresentable {
    let session: ObjectCaptureSession

    func makeUIViewController(context: Context) -> UIViewController {
        // Ce composant utilise l'UI de sélection d'objet complète d'Apple
        let objectCaptureView = ObjectCaptureView(session: session)
        let hostingController = UIHostingController(rootView: objectCaptureView)
        return hostingController
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        // Rien à mettre à jour
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
                // Nettoyer le contrôleur existant
                self.currentViewController?.willMove(toParent: nil)
                self.currentViewController?.view.removeFromSuperview()
                self.currentViewController?.removeFromParent()

                // Créer la vue appropriée
                let rootViewController = UIApplication.shared.windows.first?.rootViewController

                // Utiliser le composant ObjectCaptureWrapper qui utilise l'interface utilisateur
                // standard d'Apple pour la sélection d'objets et la capture
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

    public override func layoutSubviews() {
        super.layoutSubviews()
        containerView.frame = bounds
        currentViewController?.view.frame = containerView.bounds
    }
}
