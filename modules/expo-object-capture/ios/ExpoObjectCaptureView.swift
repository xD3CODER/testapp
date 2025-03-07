import ExpoModulesCore
import RealityKit
import SwiftUI

public class ExpoObjectCaptureView: ExpoView {
    private var hostController: UIViewController?
    private var currentSession: ObjectCaptureSession?
    private var customControls: UIView?

    required public init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
    }

    private func setupView() {
        // Initialiser avec une vue vide
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
        self.onViewReady([:])
    }

    // Méthode pour ajouter une interface de contrôle personnalisée
    private func addCustomControls() {
        // Supprimer les contrôles existants s'il y en a
        customControls?.removeFromSuperview()

        // Créer une vue pour les contrôles personnalisés
        let controlsView = UIView(frame: CGRect(x: 0, y: bounds.height - 100, width: bounds.width, height: 100))
        controlsView.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        controlsView.autoresizingMask = [.flexibleWidth, .flexibleTopMargin]

        // Ajouter un bouton pour capturer
        let captureButton = UIButton(type: .system)
        captureButton.frame = CGRect(x: (bounds.width / 2) - 40, y: 20, width: 80, height: 60)
        captureButton.setTitle("Capturer", for: .normal)
        captureButton.titleLabel?.font = UIFont.boldSystemFont(ofSize: 18)
        captureButton.setTitleColor(.white, for: .normal)
        captureButton.backgroundColor = UIColor.systemBlue
        captureButton.layer.cornerRadius = 10
        captureButton.autoresizingMask = [.flexibleLeftMargin, .flexibleRightMargin]
        captureButton.addTarget(self, action: #selector(captureButtonTapped), for: .touchUpInside)

        // Ajouter un indicateur du nombre d'images
        let imageCountLabel = UILabel(frame: CGRect(x: 20, y: 20, width: 100, height: 30))
        imageCountLabel.text = "Images: 0"
        imageCountLabel.textColor = .white
        imageCountLabel.font = UIFont.systemFont(ofSize: 16)
        imageCountLabel.tag = 100 // Pour le retrouver facilement
        imageCountLabel.autoresizingMask = [.flexibleRightMargin]

        // Ajouter un bouton pour terminer
        let finishButton = UIButton(type: .system)
        finishButton.frame = CGRect(x: bounds.width - 120, y: 20, width: 100, height: 30)
        finishButton.setTitle("Terminer", for: .normal)
        finishButton.setTitleColor(.white, for: .normal)
        finishButton.backgroundColor = UIColor.systemGreen
        finishButton.layer.cornerRadius = 5
        finishButton.autoresizingMask = [.flexibleLeftMargin]
        finishButton.addTarget(self, action: #selector(finishButtonTapped), for: .touchUpInside)

        // Ajouter les éléments à la vue de contrôle
        controlsView.addSubview(captureButton)
        controlsView.addSubview(imageCountLabel)
        controlsView.addSubview(finishButton)

        // Ajouter la vue de contrôle à la vue principale
        addSubview(controlsView)

        // Conserver la référence
        customControls = controlsView

        // Démarrer la mise à jour du compteur d'images
        startImageCountUpdates()
    }

    // Méthode pour mettre à jour le compteur d'images
    private func startImageCountUpdates() {
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] timer in
            guard let self = self, let session = self.currentSession else {
                timer.invalidate()
                return
            }

            DispatchQueue.main.async {
                if let label = self.customControls?.viewWithTag(100) as? UILabel {
                    label.text = "Images: \(session.numberOfShotsTaken)"
                }
            }
        }
    }

    // Action pour le bouton de capture
    @objc private func captureButtonTapped() {
        // Cette méthode peut être utilisée pour déclencher une capture manuelle
        // selon vos besoins spécifiques
    }

    // Action pour le bouton de fin
    @objc private func finishButtonTapped() {
        // Terminer la session de capture
        currentSession?.finish()
    }

    // IMPORTANT: Cette méthode doit être publique et bien définie
    public func setSession(_ session: ObjectCaptureSession?) {
        guard let session = session else { return }

        // Stocker la référence à la session
        currentSession = session

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

        // Ajouter des contrôles personnalisés si nécessaire
        addCustomControls()

        // Mettre à jour l'état d'AppDataModel si nécessaire
        if AppDataModel.instance.objectCaptureSession == nil {
            AppDataModel.instance.objectCaptureSession = session
        }
    }

    // Mettre à jour les sous-vues
    public override func layoutSubviews() {
        super.layoutSubviews()
        hostController?.view.frame = bounds

        // Ajuster la position des contrôles personnalisés
        if let controls = customControls {
            controls.frame = CGRect(x: 0, y: bounds.height - 100, width: bounds.width, height: 100)
        }
    }

    // Fonction d'événement pour la vue prête
    func onViewReady(_ event: [AnyHashable: Any]) {
        // Cette méthode sera appelée par le framework Expo
        // Pas besoin d'ajouter de code ici, elle est utilisée pour l'émission d'événements
    }
}