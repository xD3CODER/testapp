import ExpoModulesCore
import SwiftUI
import RealityKit
import ObjectiveC
import os

public struct ExpoGuidedCapture {
    public static let subsystem: String = "expo.modules.guidedcapture"
}

private let logger = Logger(subsystem: ExpoGuidedCapture.subsystem, category: "ExpoObjectCaptureModule")

// Protocole pour les messages de feedback
protocol AppDataModelFeedbackDelegate: AnyObject {
    func didUpdateFeedback(messages: [String])
}

// Protocole pour les événements de complétion
protocol AppDataModelCompletionDelegate: AnyObject {
    func captureDidComplete(with result: [String: Any])
    func captureDidCancel()
}

// Structure pour le cache de valeurs
struct CachedValues {
    var isSupported: Bool = {
        var result = false
        let semaphore = DispatchSemaphore(value: 0)
        
        Task { @MainActor in
            result = ObjectCaptureSession.isSupported
            semaphore.signal()
        }
        
        semaphore.wait()
        return result
    }()
    var currentState: String = "ready"
    var imageCount: Int = 0
}

// Extension d'AppDataModel pour ajouter les propriétés des délégués
extension AppDataModel {
    private struct AssociatedKeys {
        static var completionDelegateKey = "AppDataModelCompletionDelegateKey"
        static var feedbackDelegateKey = "AppDataModelFeedbackDelegateKey"
        static var resultKey = "AppDataModelResultKey"
    }

    // Propriété pour stocker le délégué de complétion
    var completionDelegate: AppDataModelCompletionDelegate? {
        get {
            return objc_getAssociatedObject(self, &AssociatedKeys.completionDelegateKey) as? AppDataModelCompletionDelegate
        }
        set {
            objc_setAssociatedObject(self, &AssociatedKeys.completionDelegateKey, newValue, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        }
    }

    // Propriété pour stocker le délégué de feedback
    var feedbackDelegate: AppDataModelFeedbackDelegate? {
        get {
            return objc_getAssociatedObject(self, &AssociatedKeys.feedbackDelegateKey) as? AppDataModelFeedbackDelegate
        }
        set {
            objc_setAssociatedObject(self, &AssociatedKeys.feedbackDelegateKey, newValue, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        }
    }

    // Propriété pour stocker les résultats
    var captureResult: [String: Any]? {
        get {
            return objc_getAssociatedObject(self, &AssociatedKeys.resultKey) as? [String: Any]
        }
        set {
            objc_setAssociatedObject(self, &AssociatedKeys.resultKey, newValue, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        }
    }

    // Méthode pour notifier le délégué de feedback
    func notifyFeedbackDelegate(messages: [String]) {
        feedbackDelegate?.didUpdateFeedback(messages: messages)
    }

    // Méthode pour compléter la capture
    @MainActor
    func completeCapture(with data: [String: Any]) {
        captureResult = data
        endCapture()
        completionDelegate?.captureDidComplete(with: data)
    }

    // Méthode pour annuler la capture
    @MainActor
    func cancelCapture() {
        captureResult = nil
        objectCaptureSession?.cancel()
        completionDelegate?.captureDidCancel()
    }

    // Méthode pour définir le gestionnaire de dossiers de capture
    @MainActor
    func setCaptureFolderManager(_ manager: CaptureFolderManager) throws {
        // Vous pouvez accéder aux propriétés privées à l'intérieur d'une extension
        self.captureFolderManager = manager
    }
}

// Module principal
public class ExpoObjectCaptureModule: Module {
    // Cache pour les valeurs synchrones
    private var cachedValues = CachedValues()

    // Propriété isolée pour la session
    @MainActor private var objectCaptureSession: ObjectCaptureSession?

    // Bridge d'événements pour la gestion des événements
    @MainActor private var eventBridge: ExpoObjectCaptureEventBridge!

    // Promise pour les opérations asynchrones
    @MainActor private var capturePromise: Promise?

    // Contrôleur pour l'interface utilisateur
    @MainActor private var hostingController: UIHostingController<AnyView>?

    public func definition() -> ModuleDefinition {
        Name("ExpoObjectCapture")

        // Définir les événements
        Events(
            "onStateChanged",
            "onFeedbackChanged",
            "onProcessingProgress",
            "onModelComplete",
            "onError",
            "onViewReady"
        )

        // Initialisation après la création
        OnCreate {
            Task { @MainActor in
                // Initialiser le bridge d'événements
                self.eventBridge = ExpoObjectCaptureEventBridge(module: self)

                // Configurer le délégué de feedback pour AppDataModel
                AppDataModel.instance.feedbackDelegate = self.eventBridge
                logger.debug("Event bridge initialized")
            }
        }

        // Définition de la vue
        View(ExpoObjectCaptureView.self) {
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

        // Fonctions asynchrones
        AsyncFunction("createCaptureSession") { (promise: Promise) in
            Task { @MainActor in
                do {
                    // Nettoyer la session existante si nécessaire
                    await self.cleanupExistingSession()

                    // Créer une nouvelle session
                    let session = try await self.createNewSession()

                    // Configurer le suivi des événements via le bridge
                    self.eventBridge.setupEventTracking(for: session)

                    promise.resolve(true)
                } catch {
                    logger.error("Erreur lors de la création de la session: \(error)")
                    self.eventBridge.sendErrorEvent(error)
                    promise.resolve(false)
                }
            }
        }

        AsyncFunction("attachSessionToView") { (promise: Promise) in
            Task { @MainActor in
                guard let session = self.objectCaptureSession else {
                    logger.error("Aucune session disponible à attacher")
                    promise.resolve(false)
                    return
                }

                // Rechercher les vues dans toutes les fenêtres
                for window in UIApplication.shared.windows {
                    self.findAndAttachSessionToViews(in: window, session: session)
                }
                promise.resolve(true)
            }
        }

        AsyncFunction("detectObject") { (promise: Promise) in
            Task { @MainActor in
                guard let session = self.objectCaptureSession else {
                    promise.resolve(false)
                    return
                }

                if session.state == .ready {
                    switch AppDataModel.instance.captureMode {
                    case .object:
                        let success = session.startDetecting()
                        promise.resolve(success)
                    case .area:
                        session.startCapturing()
                        promise.resolve(true)
                    }
                } else if case .detecting = session.state {
                    session.startCapturing()
                    promise.resolve(true)
                } else {
                    promise.resolve(false)
                }
            }
        }

        AsyncFunction("resetDetection") { (promise: Promise) in
            Task { @MainActor in
                guard let session = self.objectCaptureSession else {
                    promise.resolve(false)
                    return
                }

                if session.state == .detecting {
                    session.resetDetection()
                    promise.resolve(true)
                } else {
                    promise.resolve(false)
                }
            }
        }

        AsyncFunction("startCapture") { (options: [String: Any]?, promise: Promise) in
            Task { @MainActor in
                do {
                    // Réinitialiser l'AppDataModel si nécessaire
                    await self.cleanupExistingSession()

                    // Configurer le mode de capture
                    if let options = options, let modeString = options["captureMode"] as? String {
                        if modeString.lowercased() == "area" {
                            AppDataModel.instance.captureMode = .area
                        } else {
                            AppDataModel.instance.captureMode = .object
                        }
                    }

                    // Configurer le délégué et stocker la promesse
                    AppDataModel.instance.completionDelegate = self
                    self.capturePromise = promise

                    // Présenter l'interface de capture
                    self.presentGuidedCapture(options: options)
                } catch {
                    promise.reject(NSError(
                        domain: "ExpoObjectCapture",
                        code: 1,
                        userInfo: [NSLocalizedDescriptionKey: "Failed to start capture: \(error)"]
                    ))
                }
            }
        }

        AsyncFunction("finishCapture") { (promise: Promise) in
            Task { @MainActor in
                guard let session = self.objectCaptureSession else {
                    promise.resolve(false)
                    return
                }

                session.finish()
                promise.resolve(true)
            }
        }

        AsyncFunction("cancelCapture") { (promise: Promise) in
            Task { @MainActor in
                guard let session = self.objectCaptureSession else {
                    promise.resolve(false)
                    return
                }

                session.cancel()
                promise.resolve(true)
            }
        }

        // Fonctions synchrones
        Function("isSupported") { () -> Bool in
            return self.cachedValues.isSupported
        }

        Function("getCurrentState") { () -> String in
            return self.cachedValues.currentState
        }

        Function("getImageCount") { () -> Int in
            return self.cachedValues.imageCount
        }

        Function("setCaptureMode") { (mode: String) -> Void in
            Task { @MainActor in
                if mode.lowercased() == "area" {
                    AppDataModel.instance.captureMode = .area
                } else {
                    AppDataModel.instance.captureMode = .object
                }
            }
        }

        // Fonction asynchrone pour obtenir le nombre d'images
        AsyncFunction("getImageCountAsync") { (promise: Promise) in
            Task { @MainActor in
                let count = self.objectCaptureSession?.numberOfShotsTaken ?? 0
                self.updateCachedValue { $0.imageCount = count }
                promise.resolve(count)
            }
        }

        // Fonction de test pour le débogage
        AsyncFunction("sendTestFeedback") { (promise: Promise) in
            Task { @MainActor in
                let testMessages = ["Message de test \(Date().timeIntervalSince1970)"]

                self.eventBridge.didUpdateFeedback(messages: testMessages)
                promise.resolve(true)
            }
        }
    }

    // MARK: - Méthodes auxiliaires

    // Mise à jour du cache de manière thread-safe
    private func updateCachedValue(_ update: (inout CachedValues) -> Void) {
        var newValues = self.cachedValues
        update(&newValues)
        self.cachedValues = newValues
    }

    // Nettoyage des sessions existantes
    @MainActor
    private func cleanupExistingSession() async {
        // Nettoyer le bridge d'événements
        eventBridge.cleanup()

        // Annuler la session existante
        if let session = objectCaptureSession {
            session.cancel()
            self.objectCaptureSession = nil
        }

        // Nettoyer AppDataModel si nécessaire
        if AppDataModel.instance.state != .ready {
            if let oldSession = AppDataModel.instance.objectCaptureSession {
                oldSession.cancel()
            }
            AppDataModel.instance.endCapture()
            AppDataModel.instance.removeCaptureFolder()
        }
    }

    // Création d'une nouvelle session
    @MainActor
    private func createNewSession() async throws -> ObjectCaptureSession {
        // Créer un gestionnaire de dossier
        let captureFolderManager = try CaptureFolderManager()

        // Créer et configurer une nouvelle session
        let session = ObjectCaptureSession()
        self.objectCaptureSession = session

        var configuration = ObjectCaptureSession.Configuration()
        configuration.isOverCaptureEnabled = true
        configuration.checkpointDirectory = captureFolderManager.checkpointFolder

        // Démarrer la session
        session.start(imagesDirectory: captureFolderManager.imagesFolder,
                     configuration: configuration)

        // Configurer AppDataModel
        AppDataModel.instance.objectCaptureSession = session
        try AppDataModel.instance.setCaptureFolderManager(captureFolderManager)

        // Configurer les délégués
        AppDataModel.instance.completionDelegate = self

        logger.debug("Nouvelle session créée et configurée")
        return session
    }

    // Recherche et attache la session à toutes les instances de ExpoObjectCaptureView
    @MainActor
    private func findAndAttachSessionToViews(in view: UIView, session: ObjectCaptureSession) {
        if let captureView = view as? ExpoObjectCaptureView {
            captureView.setSession(session)
        }

        for subview in view.subviews {
            findAndAttachSessionToViews(in: subview, session: session)
        }
    }

    // Présentation de l'interface de capture guidée
    @MainActor
    private func presentGuidedCapture(options: [String: Any]?) {
        logger.debug("presentGuidedCapture appelé")

        // Trouver le contrôleur de vue visible actuel
        guard let keyWindow = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) else {
            logger.error("Aucune fenêtre active trouvée")
            capturePromise?.reject(NSError(
                domain: "ExpoObjectCapture",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "No active window found"]
            ))
            return
        }

        // Trouver le contrôleur le plus visible dans la hiérarchie
        var topController = keyWindow.rootViewController
        while let presentedController = topController?.presentedViewController {
            topController = presentedController
        }

        guard let topController = topController else {
            logger.error("Impossible de trouver un contrôleur visible")
            capturePromise?.reject(NSError(
                domain: "ExpoObjectCapture",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "No visible controller found"]
            ))
            return
        }

        logger.debug("Trouvé contrôleur visible de type: \(type(of: topController))")

        // Configurer AppDataModel
        AppDataModel.instance.completionDelegate = self

        // Créer la vue
        let contentView = ContentView().environment(AppDataModel.instance)
        self.hostingController = UIHostingController(rootView: AnyView(contentView))

        if let hostingController = self.hostingController {
            hostingController.modalPresentationStyle = .fullScreen

            // Présenter sur le contrôleur visible
            logger.debug("Présentation du contrôleur d'hébergement...")
            topController.present(hostingController, animated: true) {
                logger.debug("Contrôleur d'hébergement présenté avec succès")
            }
        } else {
            logger.error("Échec de création du contrôleur d'hébergement")
            capturePromise?.reject(NSError(
                domain: "ExpoObjectCapture",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Failed to create hosting controller"]
            ))
        }
    }
}

// Extension pour gérer le retour des résultats
extension ExpoObjectCaptureModule: AppDataModelCompletionDelegate {
    // Implémente cette méthode pour recevoir les résultats de la capture
    @MainActor
    func captureDidComplete(with result: [String: Any]) {
        // Résoudre la promesse avec les résultats
        capturePromise?.resolve(result)
        capturePromise = nil

        // Fermer la vue de capture
        dismissViewController()
    }

    @MainActor
    func captureDidCancel() {
        // Rejeter la promesse en cas d'annulation
        capturePromise?.reject(NSError(
            domain: "ExpoObjectCapture",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "Capture was cancelled"]
        ))
        capturePromise = nil

        // Fermer la vue de capture
        dismissViewController()
    }

    @MainActor
    private func dismissViewController() {
        if let rootViewController = UIApplication.shared.windows.first?.rootViewController,
           let presentedViewController = rootViewController.presentedViewController {
            presentedViewController.dismiss(animated: true, completion: nil)
        }
    }
}
