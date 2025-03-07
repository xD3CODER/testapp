import ExpoModulesCore
import SwiftUI
import RealityKit
import ObjectiveC

public struct ExpoGuidedCapture {
    public static let subsystem: String = "expo.modules.guidedcapture"
}

protocol AppDataModelCompletionDelegate: AnyObject {
    func captureDidComplete(with result: [String: Any])
    func captureDidCancel()
}

public class ExpoObjectCaptureModule: Module {
    // Session partagée pour être utilisée par plusieurs méthodes
    private var objectCaptureSession: ObjectCaptureSession?
    private var capturePromise: Promise?

    // Enregistrez votre module auprès d'Expo
    public func definition() -> ModuleDefinition {
        // Définir le nom du module tel qu'il sera utilisé dans React Native
        Name("ExpoObjectCapture")

        // Définir la vue
        View(ExpoObjectCaptureView.self) {
            Events("onViewReady")

      
                Prop("captureMode") { (view: ExpoObjectCaptureView, captureMode: String) in
                    Task { @MainActor in
                        if captureMode.lowercased() == "area" {
                            AppDataModel.instance.captureMode = .area
                        } else {
                            AppDataModel.instance.captureMode = .object
                        }
                    }
                
            }
        }

        // Méthode pour créer une nouvelle session de capture
        AsyncFunction("createCaptureSession") { (promise: Promise) in
            Task { @MainActor in
                do {
                    // Réinitialiser l'AppDataModel si nécessaire
                    if AppDataModel.instance.state != .ready {
                        AppDataModel.instance.resetForExpo()
                    }
                    
                    // Si une session existe déjà, on la nettoie
                    self.objectCaptureSession = nil
                    
                    // Créer un nouveau gestionnaire de dossier de capture
                    let captureFolderManager = try CaptureFolderManager()
                    
                    // Créer une nouvelle session
                    let session = ObjectCaptureSession()
                    self.objectCaptureSession = session
                    
                    // Configuration de la session
                    var configuration = ObjectCaptureSession.Configuration()
                    configuration.isOverCaptureEnabled = true
                    configuration.checkpointDirectory = captureFolderManager.checkpointFolder
                    
                    // Démarrer la session
                    session.start(imagesDirectory: captureFolderManager.imagesFolder,
                                 configuration: configuration)
                    
                    // Définir la session dans AppDataModel
                    AppDataModel.instance.objectCaptureSession = session
                    
                    // Configurer le delegué pour les callbacks
                    AppDataModel.instance.completionDelegate = self
                    
                    promise.resolve(true)
                } catch {
                    print("Erreur lors de la création de la session: \(error)")
                    promise.resolve(false)
                }
            }
        }

        // Méthode pour attacher la session à la vue
        Function("attachSessionToView") { () -> Bool in
            guard let session = self.objectCaptureSession else {
                print("Aucune session disponible à attacher")
                return false
            }

            DispatchQueue.main.async {
                // Récupérer toutes les instances de ExpoObjectCaptureView
                for window in UIApplication.shared.windows {
                    self.findAndAttachSessionToViews(in: window, session: session)
                }
            }
            return true
        }

        // Définir une fonction qui peut être appelée depuis React Native pour démarrer la capture
        Function("startCapture") { (options: [String: Any]?) -> Void in
            // Exécutez dans le thread principal car nous manipulons l'UI
            Task { @MainActor in
                self.presentGuidedCapture(options: options)
            }
        }

        // Fonction pour modifier le mode de capture (objet ou zone)
        Function("setCaptureMode") { (mode: String) -> Void in
            Task { @MainActor in
                if mode.lowercased() == "area" {
                    AppDataModel.instance.captureMode = .area
                } else {
                    AppDataModel.instance.captureMode = .object
                }
            }
        }

        // Fonction pour terminer la session de capture
        AsyncFunction("finishCaptureSession") { (promise: Promise) in
            Task { @MainActor in
                guard let session = self.objectCaptureSession else {
                    promise.resolve(false)
                    return
                }
                
                session.finish()
                promise.resolve(true)
            }
        }

        // Fonction pour annuler la session de capture
        AsyncFunction("cancelCaptureSession") { (promise: Promise) in
            Task { @MainActor in
                guard let session = self.objectCaptureSession else {
                    promise.resolve(false)
                    return
                }
                
                session.cancel()
                promise.resolve(true)
            }
        }

        // Événement pour renvoyer les résultats à React Native
        AsyncFunction("captureComplete") { (promise: Promise) in
            // Cette propriété stockera notre promesse pour la résoudre plus tard
            self.capturePromise = promise
        }

        // Fonction pour récupérer le nombre d'images capturées
        Function("getImageCount") { () -> Int in
            // Créer une variable pour stocker le résultat
            var count = 0

            // Créer un sémaphore pour attendre le résultat
            let semaphore = DispatchSemaphore(value: 0)

            // Exécuter sur l'acteur principal pour accéder à la propriété
            Task { @MainActor in
                if let session = AppDataModel.instance.objectCaptureSession {
                    count = session.numberOfShotsTaken
                }
                semaphore.signal()
            }

            // Attendre le résultat (avec un timeout pour éviter les blocages)
            _ = semaphore.wait(timeout: .now() + 1.0)

            return count
        }

        // Version asynchrone pour obtenir le nombre d'images
        AsyncFunction("getImageCountAsync") { (promise: Promise) in
            Task { @MainActor in
                let count = AppDataModel.instance.objectCaptureSession?.numberOfShotsTaken ?? 0
                promise.resolve(count)
            }
        }
    }

    // Recherche et attache la session à toutes les instances de ExpoObjectCaptureView
    private func findAndAttachSessionToViews(in view: UIView, session: ObjectCaptureSession) {
        if let captureView = view as? ExpoObjectCaptureView {
            captureView.setSession(session)
        }

        for subview in view.subviews {
            findAndAttachSessionToViews(in: subview, session: session)
        }
    }

    // Stockez la promesse pour la résoudre lorsque la capture est terminée
    private var hostingController: UIHostingController<AnyView>?

    // Présentez l'interface de capture guidée
    @MainActor
    private func presentGuidedCapture(options: [String: Any]?) {
        // Obtenez le contrôleur de vue racine
        guard let rootViewController = UIApplication.shared.windows.first?.rootViewController else {
            capturePromise?.reject(NSError(domain: "ExpoObjectCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to get root view controller"]))
            return
        }

        // Réinitialiser l'AppDataModel si nécessaire
        if AppDataModel.instance.state != .ready {
            AppDataModel.instance.resetForExpo()
        }

        // Configurez AppDataModel avec les options si nécessaire
        if let captureOptions = options {
            if let modeString = captureOptions["captureMode"] as? String,
               modeString.lowercased() == "area" {
                AppDataModel.instance.captureMode = .area
            } else {
                AppDataModel.instance.captureMode = .object
            }

            // D'autres configurations si nécessaire
        }

        // Configurez le delegate pour recevoir les callbacks de l'app native
        AppDataModel.instance.completionDelegate = self

        // Créez une vue hôte SwiftUI qui contiendra votre ContentView
        let contentView = ContentView()
        let anyView = AnyView(contentView)

        // Créez un contrôleur pour héberger la vue SwiftUI
        self.hostingController = UIHostingController(rootView: anyView)

        // Configurez le contrôleur
        if let hostingController = self.hostingController {
            hostingController.modalPresentationStyle = .fullScreen

            // Présentez le contrôleur de vue
            rootViewController.present(hostingController, animated: true, completion: nil)
        } else {
            capturePromise?.reject(NSError(domain: "ExpoObjectCapture", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to create hosting controller"]))
        }
    }
}

// Extension pour gérer le retour des résultats
extension ExpoObjectCaptureModule: AppDataModelCompletionDelegate {
    // Implémentez cette méthode pour recevoir les résultats de la capture
    func captureDidComplete(with result: [String: Any]) {
        // Résolvez la promesse avec les résultats
        capturePromise?.resolve(result)
        capturePromise = nil

        // Fermez la vue de capture
        dismissViewController()
    }

    func captureDidCancel() {
        // Rejetez la promesse en cas d'annulation
        capturePromise?.reject(NSError(domain: "ExpoObjectCapture", code: 0, userInfo: [NSLocalizedDescriptionKey: "Capture was cancelled"]))
        capturePromise = nil

        // Fermez la vue de capture
        dismissViewController()
    }

    private func dismissViewController() {
        DispatchQueue.main.async {
            self.hostingController?.dismiss(animated: true, completion: nil)
            self.hostingController = nil
        }
    }
}

// Extension pour AppDataModel pour ajouter les fonctionnalités nécessaires
extension AppDataModel {
    // Propriété pour stocker le délégué
    private struct AssociatedKeys {
        static var delegateKey = "AppDataModelCompletionDelegateKey"
        static var resultKey = "AppDataModelResultKey"
    }

    // Propriété pour stocker le délégué
    var completionDelegate: AppDataModelCompletionDelegate? {
        get {
            return objc_getAssociatedObject(self, &AssociatedKeys.delegateKey) as? AppDataModelCompletionDelegate
        }
        set {
            objc_setAssociatedObject(self, &AssociatedKeys.delegateKey, newValue, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        }
    }

    // Propriété pour stocker les données de résultat
    var captureResult: [String: Any]? {
        get {
            return objc_getAssociatedObject(self, &AssociatedKeys.resultKey) as? [String: Any]
        }
        set {
            objc_setAssociatedObject(self, &AssociatedKeys.resultKey, newValue, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        }
    }

    // Méthode pour réinitialiser le modèle
    @MainActor
    func resetForExpo() {
        // Si un résultat est disponible, le renvoyer au délégué avant de réinitialiser
        if let result = self.captureResult {
            self.completionDelegate?.captureDidComplete(with: result)
            self.captureResult = nil
        }

        // Réinitialiser l'état si nécessaire
        if self.state != .ready {
            self.state = .completed // Ceci devrait appeler indirectement reset() via le didSet
        }
    }

    // Méthode pour terminer la capture avec succès
    @MainActor
    func completeCapture(with data: [String: Any]) {
        // Stockez les données
        self.captureResult = data

        // Appeler la méthode pour terminer la capture
        self.endCapture()

        // Notifiez le delegate
        self.completionDelegate?.captureDidComplete(with: data)
    }

    // Méthode pour annuler la capture
    @MainActor
    func cancelCapture() {
        // Réinitialisez les données
        self.captureResult = nil

        // Terminer la session de capture
        self.objectCaptureSession?.cancel()

        // Notifiez le delegate
        self.completionDelegate?.captureDidCancel()
    }
}
