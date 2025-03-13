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

    public func setSession(_ session: ObjectCaptureSession?) {
        guard let session = session else { return }

        // Stocker la référence à la session
        currentSession = session
            // Créer la vue avec la session
            let combinedView = UIHostingController(rootView:
                 ZStack {
                     // Vue de base pour la capture
                     ObjectCaptureView(session: session, cameraFeedOverlay: {
                         // Vous pouvez ajouter un gradient ou autre overlay ici si nécessaire
                         Color.clear
                     })
                       .hideObjectReticle(true)
                        if session.state == .ready || session.state == .detecting {
                          CustomRoundReticleView()
                         }

                     // Superposer les contrôles d'interface
                     CaptureOverlayView(session: session)
                 }
                 .edgesIgnoringSafeArea(.all)
                 .environment(AppDataModel.instance) 
             )
            // Supprimer l'ancienne vue
            hostController?.view.removeFromSuperview()

            // Ajouter la nouvelle vue
            combinedView.view.frame = bounds
            combinedView.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            addSubview(combinedView.view)

            // Conserver la référence
            hostController = combinedView

            // Mettre à jour l'état d'AppDataModel si nécessaire
            if AppDataModel.instance.objectCaptureSession == nil {
                AppDataModel.instance.objectCaptureSession = session
            }
    }

    // Mettre à jour les sous-vues
    public override func layoutSubviews() {
        super.layoutSubviews()
        hostController?.view.frame = bounds
    }
}

// Vue de réticule personnalisée
struct CustomRoundReticleView: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        GeometryReader { geometry in
            // Calcul de la taille à 75% de la largeur de l'écran
            let size = min(geometry.size.width, geometry.size.height) * 0.75

            ZStack {
                // Centrer le contenu
                Group {
                    // Cercle extérieur
                    Circle()
                        .strokeBorder(Color.white, lineWidth: 2)
                        .frame(width: size, height: size)

                    // Cercle intérieur ou point central
                    Circle()
                        .fill(Color.white)
                        .frame(width: 22, height: 22)

                    // Lignes directionnelles optionnelles
                    Group {
                        Rectangle() // Ligne horizontale gauche
                            .fill(Color.white)
                            .frame(width: size * 0.1, height: 2)
                            .offset(x: -size * 0.4)

                        Rectangle() // Ligne horizontale droite
                            .fill(Color.white)
                            .frame(width: size * 0.1, height: 2)
                            .offset(x: size * 0.4)

                        Rectangle() // Ligne verticale haute
                            .fill(Color.white)
                            .frame(width: 2, height: size * 0.1)
                            .offset(y: -size * 0.4)

                        Rectangle() // Ligne verticale basse
                            .fill(Color.white)
                            .frame(width: 2, height: size * 0.1)
                            .offset(y: size * 0.4)
                    }
                }
                .opacity(0.6)
                .position(x: geometry.size.width / 2, y: geometry.size.height / 2)
            }
            .allowsHitTesting(false) // Pour que les touches passent à travers
        }
    }
}
