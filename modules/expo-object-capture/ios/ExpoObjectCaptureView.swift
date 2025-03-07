import ExpoModulesCore
import RealityKit
import SwiftUI

public class ExpoObjectCaptureView: ExpoView {
    private var hostController: UIViewController?
    private var currentSession: ObjectCaptureSession?
    
    // Définir l'émetteur d'événements pour onViewReady
    let onViewReady = EventDispatcher()

    required public init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
    }

    private func setupView() {
        // Initialiser avec une vue d'attente simple
        let emptyView = UIHostingController(rootView:
            ZStack {
                Color.black.edgesIgnoringSafeArea(.all)
                Text("En attente de la session de capture...")
                    .foregroundColor(.white)
                    .font(.headline)
            }
        )

        emptyView.view.frame = bounds
        emptyView.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(emptyView.view)
        hostController = emptyView

        // Émettre un événement indiquant que la vue est prête
        DispatchQueue.main.async {
            // Utiliser l'EventDispatcher pour envoyer l'événement
            self.onViewReady([:])
        }
    }

    // IMPORTANT: Cette méthode doit être publique pour configurer la session
    public func setSession(_ session: ObjectCaptureSession?) {
        guard let session = session else { return }

        // Stocker la référence à la session
        currentSession = session

        // Définir l'interface d'objectCapture
        if #available(iOS 18.0, *) {
            // Créer la vue avec la session
            let contentView = UIHostingController(rootView:
                ZStack {
                    ObjectCaptureView(session: session)
                        .edgesIgnoringSafeArea(.all)
                }
            )

            // Supprimer l'ancienne vue
            hostController?.view.removeFromSuperview()

            // Ajouter la nouvelle vue
            contentView.view.frame = bounds
            contentView.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            addSubview(contentView.view)

            // Conserver la référence
            hostController = contentView

            // Mettre à jour l'état d'AppDataModel si nécessaire
            if AppDataModel.instance.objectCaptureSession == nil {
                AppDataModel.instance.objectCaptureSession = session
            }
        } else {
            // Afficher un message d'erreur pour les versions iOS non supportées
            let errorView = UIHostingController(rootView:
                ZStack {
                    Color.black.edgesIgnoringSafeArea(.all)
                    VStack {
                        Text("iOS 18+ Required")
                            .foregroundColor(.white)
                            .font(.title)
                            .bold()
                        
                        Text("Object Capture requires iOS 18 or later")
                            .foregroundColor(.white)
                            .font(.body)
                            .multilineTextAlignment(.center)
                            .padding(.top, 8)
                    }
                    .padding()
                }
            )
            
            // Supprimer l'ancienne vue
            hostController?.view.removeFromSuperview()
            
            // Ajouter la nouvelle vue
            errorView.view.frame = bounds
            errorView.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            addSubview(errorView.view)
            
            // Conserver la référence
            hostController = errorView
        }
    }

    // Mettre à jour les sous-vues
    public override func layoutSubviews() {
        super.layoutSubviews()
        hostController?.view.frame = bounds
    }
}
