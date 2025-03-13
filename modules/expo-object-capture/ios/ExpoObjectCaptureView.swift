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

    public func setSession(_ session: ObjectCaptureSession?) {
        guard let session = session, #available(iOS 18.0, *) else { return }

        currentSession = session

        // Vue combinée unique, enveloppée dans AnyView
        let captureView = UIHostingController(rootView:
            AnyView(
                ZStack {
                    ObjectCaptureView(session: session, cameraFeedOverlay: { Color.clear })
                        .hideObjectReticle(true)
                    CaptureOverlayView(session: session)
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


//force refresh