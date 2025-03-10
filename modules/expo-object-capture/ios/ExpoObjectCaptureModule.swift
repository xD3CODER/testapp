import ExpoModulesCore
import SwiftUI
import RealityKit
import ObjectiveC

public struct ExpoGuidedCapture {
    public static let subsystem: String = "expo.modules.guidedcapture"
}

// Définition du protocole en premier
protocol AppDataModelFeedbackDelegate: AnyObject {
    func didUpdateFeedback(messages: [String])
}

// Structure pour stocker des valeurs qui peuvent être accédées de façon synchrone
struct CachedValues {
    var isSupported: Bool = false
    var currentState: String = "ready"
    var imageCount: Int = 0
}

protocol AppDataModelCompletionDelegate: AnyObject {
    func captureDidComplete(with result: [String: Any])
    func captureDidCancel()
}

// Ajout de l'extension AppDataModel avant la classe principale pour éviter les erreurs de référence future
extension AppDataModel {
    private struct AssociatedKeys {
        static var delegateKey = "AppDataModelCompletionDelegateKey"
        static var resultKey = "AppDataModelResultKey"
        static var feedbackDelegateKey = "AppDataModelFeedbackDelegateKey"
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

    // Propriété pour stocker le delegate de feedback
    var feedbackDelegate: AppDataModelFeedbackDelegate? {
        get {
            return objc_getAssociatedObject(self, &AssociatedKeys.feedbackDelegateKey) as? AppDataModelFeedbackDelegate
        }
        set {
            objc_setAssociatedObject(self, &AssociatedKeys.feedbackDelegateKey, newValue, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        }
    }

    @MainActor
    func setCaptureFolderManager(_ manager: CaptureFolderManager) {
        // Vous pouvez accéder aux propriétés privées à l'intérieur d'une extension
        self.captureFolderManager = manager
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

    // Cette méthode est appelée pour notifier le delegate quand les messages de feedback changent
    // Il faut l'appeler depuis updateFeedbackMessages en surchargeant la méthode
    func notifyFeedbackDelegate(messages: [String]) {
        if let delegate = feedbackDelegate {
            DispatchQueue.main.async {
                delegate.didUpdateFeedback(messages: messages)
                print("DEBUG: AppDataModel a notifié le delegate avec messages:", messages)
            }
        }
    }
}

// Définition de l'extension spécifique après la définition du protocole
extension ExpoObjectCaptureModule: AppDataModelFeedbackDelegate {
    func didUpdateFeedback(messages: [String]) {
        // Envoyer directement les messages à React Native
        DispatchQueue.main.async {
            self.sendEvent("onFeedbackChanged", [
                "messages": messages
            ])
            print("DEBUG: Bridge a envoyé l'événement feedback:", messages)
        }
    }
}

// Classe principale pour le module
public class ExpoObjectCaptureModule: Module {
    // Session partagée pour être utilisée par plusieurs méthodes
    @MainActor private var objectCaptureSession: ObjectCaptureSession?
    @MainActor private var capturePromise: Promise?

    // Pour suivre l'état et émettre des événements
    @MainActor private var isTrackingState: Bool = false
    @MainActor private var isTrackingFeedback: Bool = false
    @MainActor private var lastReportedState: String = "ready"
    @MainActor private var lastReportedFeedback: [String] = []

    @MainActor private var feedbackTimers: [Timer] = []
    @MainActor private var hostingController: UIHostingController<AnyView>?

    // Cache pour les valeurs à accéder de façon synchrone - c'est une variable non-isolée
    private var cachedValues = CachedValues()

    // Définition du module
    public func definition() -> ModuleDefinition {
        // Définir le nom du module
        Name("ExpoObjectCapture")

        // Définir les événements
        Events("onStateChanged", "onFeedbackChanged", "onProcessingProgress", "onModelComplete", "onError", "onViewReady")

        // Initialiser après création
        OnCreate {
            Task { @MainActor in
                self.initializeCache()
            }
        }

        // Définir la vue
        View(ExpoObjectCaptureView.self) {
            // Propriétés de la vue
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
                    // D'abord, nettoyez toute session existante
                    if let session = self.objectCaptureSession {
                        session.cancel()
                        self.objectCaptureSession = nil
                    }

                    // Nettoyez également AppDataModel si nécessaire
                    if AppDataModel.instance.state != .ready {
                        if let oldSession = AppDataModel.instance.objectCaptureSession {
                            oldSession.cancel()
                        }
                        AppDataModel.instance.endCapture()
                        AppDataModel.instance.removeCaptureFolder()
                    }

                    // Maintenant, créez un nouveau gestionnaire de dossier
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
                    AppDataModel.instance.setCaptureFolderManager(captureFolderManager)

                    // Configurer les delegates pour les callbacks
                    AppDataModel.instance.completionDelegate = self
                    AppDataModel.instance.feedbackDelegate = self
                    print("DEBUG: Bridge de feedback configuré dans createCaptureSession")

                    // Démarrer le suivi des états et du feedback
                    self.startTrackingSessionUpdates(session: session)

                    promise.resolve(true)
                } catch {
                    print("Erreur lors de la création de la session: \(error)")
                    self.sendEvent("onError", [
                        "message": "Erreur lors de la création de la session: \(error)"
                    ])
                    promise.resolve(false)
                }
            }
        }

        // Méthode pour attacher la session à la vue
        AsyncFunction("attachSessionToView") { (promise: Promise) in
            Task { @MainActor in
                guard let session = self.objectCaptureSession else {
                    print("Aucune session disponible à attacher")
                    promise.resolve(false)
                    return
                }

                // Récupérer toutes les instances de ExpoObjectCaptureView
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
                    switch  AppDataModel.instance.captureMode {
                    case .object:
                        let hasDetectionFailed = !(session.startDetecting())
                        promise.resolve(hasDetectionFailed)
                    case .area:
                        session.startCapturing()
                    }
                } else if case .detecting = session.state {
                    session.startCapturing()
                }
                promise.resolve(true)
            }
        }

        // Définir une fonction qui peut être appelée depuis React Native pour démarrer la capture
        AsyncFunction("startCapture") { (options: [String: Any]?, promise: Promise) in
            Task { @MainActor in
                do {
                    // Réinitialiser l'AppDataModel si nécessaire
                    if AppDataModel.instance.state != .ready {
                        if let oldSession = AppDataModel.instance.objectCaptureSession {
                            oldSession.cancel()
                        }
                        AppDataModel.instance.endCapture()
                    }

                    // Configurer le mode de capture si spécifié
                    if let options = options, let modeString = options["captureMode"] as? String {
                        if modeString.lowercased() == "area" {
                            AppDataModel.instance.captureMode = .area
                        } else {
                            AppDataModel.instance.captureMode = .object
                        }
                    }

                    // Configurer le delegate pour recevoir les callbacks
                    AppDataModel.instance.completionDelegate = self

                    // Stocker la promesse pour la résoudre plus tard
                    self.capturePromise = promise

                    // Présenter l'interface de capture guidée
                    self.presentGuidedCapture(options: options)
                } catch {
                    promise.reject(NSError(domain: "ExpoObjectCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to start capture: \(error)"]))
                }
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

        // Fonction pour annuler la session de capture
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

        // Fonction pour deselectionner la bbox
        AsyncFunction("resetDetection") { (promise: Promise) in
            Task { @MainActor in
                guard let session = self.objectCaptureSession else {
                    promise.resolve(false)
                    return
                }

                session.resetDetection()
                promise.resolve(true)
            }
        }

        // Fonction pour vérifier si la capture est supportée - utilise la valeur mise en cache
        Function("isSupported") { () -> Bool in
            return self.cachedValues.isSupported
        }

        // Fonction pour obtenir l'état actuel - utilise la valeur mise en cache
        Function("getCurrentState") { () -> String in
            return self.cachedValues.currentState
        }

        // Fonction pour récupérer le nombre d'images capturées - utilise la valeur mise en cache
        Function("getImageCount") { () -> Int in
            return self.cachedValues.imageCount
        }

        // Version asynchrone pour obtenir le nombre d'images
        AsyncFunction("getImageCountAsync") { (promise: Promise) in
            Task { @MainActor in
                let count = self.objectCaptureSession?.numberOfShotsTaken ?? 0
                self.updateCachedValue { $0.imageCount = count }
                promise.resolve(count)
            }
        }

        // Événement pour renvoyer les résultats à React Native
        AsyncFunction("captureComplete") { (promise: Promise) in
            Task { @MainActor in
                // Cette propriété stockera notre promesse pour la résoudre plus tard
                self.capturePromise = promise
            }
        }

        // Fonction pour envoyer un feedback de test (utile pour le débogage)
        AsyncFunction("sendTestFeedback") { (promise: Promise) in
            Task { @MainActor in
                // Créer un événement de test
                let testMessages = ["Message de test \(Date().timeIntervalSince1970)"]

                // Utiliser DispatchQueue.main pour s'assurer que l'événement est envoyé sur le thread principal
                DispatchQueue.main.async {
                    self.sendEvent("onFeedbackChanged", [
                        "messages": testMessages
                    ])
                    print("DEBUG: Événement de test envoyé:", testMessages)
                }

                promise.resolve(true)
            }
        }
    }

    // Méthode pour mettre à jour les valeurs en cache de façon thread-safe
    private func updateCachedValue(_ update: (inout CachedValues) -> Void) {
        var newValues = self.cachedValues
        update(&newValues)
        self.cachedValues = newValues
    }

    // Initialisation du cache pour les accès synchrones
    @MainActor
    private func initializeCache() {
        // Vérifier si ObjectCaptureSession est supporté
        let isSupported = ObjectCaptureSession.isSupported
        self.updateCachedValue { $0.isSupported = isSupported }

        // Configurer le bridge de feedback
        AppDataModel.instance.feedbackDelegate = self
        print("DEBUG: Bridge de feedback configuré dans initializeCache")

        // Initialiser les autres valeurs de cache
        self.updateCachedValue { values in
            values.currentState = "ready"
            values.imageCount = 0
        }

        // Démarrer une tâche qui met à jour périodiquement le cache
        Task {
            while true {
                // Mettre à jour les valeurs mises en cache
                if let session = self.objectCaptureSession {
                    let state: String
                    switch session.state {
                    case .initializing:
                        state = "initializing"
                    case .ready:
                        state = "ready"
                    case .detecting:
                        state = "detecting"
                    case .capturing:
                        state = "capturing"
                    case .finishing:
                        state = "finishing"
                    case .completed:
                        state = "completed"
                    case .failed:
                        state = "failed"
                    @unknown default:
                        state = "unknown"
                    }

                    let count = session.numberOfShotsTaken

                    self.updateCachedValue { values in
                        values.currentState = state
                        values.imageCount = count
                    }
                }

                // Attendre un court instant avant la prochaine mise à jour
                try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 secondes
            }
        }
    }

    func isActiveState(_ state: ObjectCaptureSession.CaptureState) -> Bool {
    switch state {
        case .completed, .failed:
            return false
        default:
            return true
    }
}

    // Commencer à suivre les mises à jour de la session
    @MainActor
    private func startTrackingSessionUpdates(session: ObjectCaptureSession) {
        print("DEBUG: Démarrage du suivi des mises à jour de session")

        // Suivre les changements d'état - cette tâche ne doit JAMAIS se terminer tant que la session existe
        Task {
            do {
                // Suivre les changements d'état en continu
                while isActiveState(session.state) {
                    for await newState in session.stateUpdates {
                        print("DEBUG: Nouvel état reçu:", newState)

                        // Convertir l'état en chaîne de caractères
                        let stateString: String
                        switch newState {
                        case .initializing:
                            stateString = "initializing"
                        case .ready:
                            stateString = "ready"
                        case .detecting:
                            stateString = "detecting"
                        case .capturing:
                            stateString = "capturing"
                        case .finishing:
                            stateString = "finishing"
                        case .completed:
                            stateString = "completed"
                        case .failed(let error):
                            stateString = "failed"
                            // Utiliser un type d'erreur générique pour éviter les problèmes de typage
                            self.sendEvent("onError", [
                                "message": "\(error)"
                            ])
                        @unknown default:
                            stateString = "unknown"
                        }

                        // Mettre à jour la valeur en cache et émettre l'événement
                        self.updateCachedValue { $0.currentState = stateString }

                        // Émettre l'événement même si l'état n'a pas changé pour s'assurer que le client reçoit les mises à jour
                        self.lastReportedState = stateString

                        // Utiliser DispatchQueue.main pour s'assurer que l'événement est envoyé sur le thread principal
                        DispatchQueue.main.async {
                            self.sendEvent("onStateChanged", [
                                "state": stateString
                            ])
                            print("DEBUG: Événement d'état envoyé:", stateString)
                        }

                        // Vérifier si la session est terminée
                        if newState == .completed, let captureFolderManager = AppDataModel.instance.captureFolderManager {
                            // Construire les chemins des fichiers
                            let modelPath = captureFolderManager.modelsFolder.appendingPathComponent("model-mobile.usdz").path
                            let previewPath = captureFolderManager.modelsFolder.appendingPathComponent("model-mobile.usdz").path

                            // Envoyer l'événement de complétion du modèle
                            DispatchQueue.main.async {
                                self.sendEvent("onModelComplete", [
                                    "modelPath": modelPath,
                                    "previewPath": previewPath
                                ])
                                print("DEBUG: Événement de complétion du modèle envoyé")
                            }

                            // Résoudre la promesse si elle existe
                            if let promise = self.capturePromise {
                                promise.resolve([
                                    "success": true,
                                    "modelUrl": modelPath,
                                    "previewUrl": previewPath,
                                    "imageCount": session.numberOfShotsTaken,
                                    "timestamp": Date().timeIntervalSince1970
                                ])
                                self.capturePromise = nil
                            }
                        }
                    }

                    // Si on sort de la boucle for-await, attendre un peu et réessayer
                    // (cela évite que la tâche se termine si l'itérateur renvoie nil temporairement)
                    print("DEBUG: Itérateur stateUpdates terminé, attente avant nouvelle tentative...")
                    try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 seconde
                }
            } catch {
                // Capturer toute exception pour éviter que la tâche ne se termine silencieusement
                print("ERROR: Exception dans la tâche de suivi d'état:", error)
            }

            self.isTrackingState = false
            print("DEBUG: Tâche de suivi d'état terminée")
        }

        // Suivre les changements de feedback - cette tâche aussi doit rester active
        Task {
            do {
                // Suivre les changements de feedback en continu
                while isActiveState(session.state) {
                    for await feedback in session.feedbackUpdates {
                        print("DEBUG: Nouveau feedback reçu:", feedback)

                        // Convertir le feedback en messages lisibles
                        var messages: [String] = []

                        for item in feedback {
                            if let message = FeedbackMessages.getFeedbackString(for: item, captureMode: AppDataModel.instance.captureMode) {
                                messages.append(message)
                            }
                        }

                        // Toujours émettre l'événement, même si le feedback n'a pas changé
                        self.lastReportedFeedback = messages

                        // Utiliser DispatchQueue.main pour s'assurer que l'événement est envoyé sur le thread principal
                        DispatchQueue.main.async {
                            self.sendEvent("onFeedbackChanged", [
                                "messages": messages
                            ])
                            print("DEBUG: Événement feedback envoyé:", messages)
                        }
                    }

                    // Si on sort de la boucle for-await, attendre un peu et réessayer
                    print("DEBUG: Itérateur feedbackUpdates terminé, attente avant nouvelle tentative...")
                    try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 seconde
                }
            } catch {
                // Capturer toute exception pour éviter que la tâche ne se termine silencieusement
                print("ERROR: Exception dans la tâche de suivi de feedback:", error)
            }

            self.isTrackingFeedback = false
            print("DEBUG: Tâche de suivi de feedback terminée")
        }
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

    @MainActor
    private func presentGuidedCapture(options: [String: Any]?) {
        print("DEBUG: presentGuidedCapture appelé")

        // Trouver le contrôleur de vue visible actuel plutôt que simplement le rootViewController
        guard let keyWindow = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) else {
            print("ERROR: Aucune fenêtre active trouvée")
            capturePromise?.reject(NSError(domain: "ExpoObjectCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "No active window found"]))
            return
        }

        // Trouver le contrôleur le plus visible dans la hiérarchie
        var topController = keyWindow.rootViewController
        while let presentedController = topController?.presentedViewController {
            topController = presentedController
        }

        guard let topController = topController else {
            print("ERROR: Impossible de trouver un contrôleur visible")
            capturePromise?.reject(NSError(domain: "ExpoObjectCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "No visible controller found"]))
            return
        }

        print("DEBUG: Trouvé contrôleur visible de type: \(type(of: topController))")

        // Configurer AppDataModel
        AppDataModel.instance.completionDelegate = self
        AppDataModel.instance.feedbackDelegate = self

        // Créer la vue
        let contentView = ContentView().environment(AppDataModel.instance)
        self.hostingController = UIHostingController(rootView: AnyView(contentView))

        if let hostingController = self.hostingController {
            hostingController.modalPresentationStyle = .fullScreen

            // Présenter sur le contrôleur visible
            print("DEBUG: Présentation du contrôleur d'hébergement...")
            topController.present(hostingController, animated: true) {
                print("DEBUG: Contrôleur d'hébergement présenté avec succès")
            }
        } else {
            print("ERROR: Échec de création du contrôleur d'hébergement")
            capturePromise?.reject(NSError(domain: "ExpoObjectCapture", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to create hosting controller"]))
        }
    }
}

// Extension pour gérer le retour des résultats
extension ExpoObjectCaptureModule: AppDataModelCompletionDelegate {
    // Implémentez cette méthode pour recevoir les résultats de la capture
    @MainActor
    func captureDidComplete(with result: [String: Any]) {
        // Résolvez la promesse avec les résultats
        capturePromise?.resolve(result)
        capturePromise = nil

        // Fermez la vue de capture
        dismissViewController()
    }

    @MainActor
    func captureDidCancel() {
        // Rejetez la promesse en cas d'annulation
        capturePromise?.reject(NSError(domain: "ExpoObjectCapture", code: 0, userInfo: [NSLocalizedDescriptionKey: "Capture was cancelled"]))
        capturePromise = nil

        // Fermez la vue de capture
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

// Maintenant nous avons besoin d'un hook pour AppDataModel.updateFeedbackMessages
// Puisque nous ne pouvons pas modifier directement la méthode privée, nous devons ajouter un hook dans AppDataModel
// qui sera appelé par updateFeedbackMessages après avoir mis à jour les messages

// Cette extension est nécessaire pour que Swift monke-patch la méthode updateFeedbackMessages
// Elle n'est pas implémentée dans cet exemple car nous ne pouvons pas modifier le code source d'AppDataModel directement.
// Vous devrez ajouter un appel à notifyFeedbackDelegate() dans la méthode updateFeedbackMessages de votre AppDataModel.
