import ExpoModulesCore
import SwiftUI
import RealityKit
import ObjectiveC

public struct ExpoGuidedCapture {
    public static let subsystem: String = "expo.modules.guidedcapture"
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
                    // Réinitialiser l'AppDataModel si nécessaire
                    if AppDataModel.instance.state != .ready {
                        if let oldSession = AppDataModel.instance.objectCaptureSession {
                            oldSession.cancel()
                        }
                        AppDataModel.instance.endCapture()
                    }
                    
                    // Si une session existe déjà, on la nettoie
                    if let session = self.objectCaptureSession {
                        session.cancel()
                    }
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

    // Commencer à suivre les mises à jour de la session
    @MainActor
    private func startTrackingSessionUpdates(session: ObjectCaptureSession) {
        // Éviter les duplications
        if isTrackingState {
            return
        }
        isTrackingState = true
        
        // Suivre les changements d'état
        Task {
            for await newState in session.stateUpdates {
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
                    self.sendEvent("onError", [
                        "message": "\(error)"
                    ])
                @unknown default:
                    stateString = "unknown"
                }
                
                // Mettre à jour la valeur en cache
                self.updateCachedValue { $0.currentState = stateString }
                
                // Émettre l'événement seulement si l'état a changé
                if self.lastReportedState != stateString {
                    self.lastReportedState = stateString
                    self.sendEvent("onStateChanged", [
                        "state": stateString
                    ])
                }
                
                // Vérifier si la session est terminée
                if newState == .completed, let captureFolderManager = AppDataModel.instance.captureFolderManager {
                    // Construire les chemins des fichiers
                    let modelPath = captureFolderManager.modelsFolder.appendingPathComponent("model-mobile.usdz").path
                    let previewPath = captureFolderManager.modelsFolder.appendingPathComponent("model-mobile.usdz").path
                    
                    // Envoyer l'événement de complétion du modèle
                    self.sendEvent("onModelComplete", [
                        "modelPath": modelPath,
                        "previewPath": previewPath
                    ])
                    
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
            self.isTrackingState = false
        }
        
        // Suivre les changements de feedback
        if !isTrackingFeedback {
            isTrackingFeedback = true
            Task {
                for await feedback in session.feedbackUpdates {
                    // Convertir le feedback en messages lisibles
                    var messages: [String] = []
                    
                    for item in feedback {
                        if let message = FeedbackMessages.getFeedbackString(for: item, captureMode: AppDataModel.instance.captureMode) {
                            messages.append(message)
                        }
                    }
                    
                    // Émettre l'événement seulement si le feedback a changé
                    if self.lastReportedFeedback != messages {
                        self.lastReportedFeedback = messages
                        self.sendEvent("onFeedbackChanged", [
                            "messages": messages
                        ])
                    }
                }
                self.isTrackingFeedback = false
            }
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

    // Présenter l'interface de capture guidée
    @MainActor
    private func presentGuidedCapture(options: [String: Any]?) {
        print("DEBUG: presentGuidedCapture appelé")
        
        // Obtenez le contrôleur de vue racine
        guard let rootViewController = UIApplication.shared.windows.first?.rootViewController else {
            print("DEBUG: Impossible de trouver le rootViewController")
            capturePromise?.reject(NSError(domain: "ExpoObjectCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to get root view controller"]))
            return
        }
        
        print("DEBUG: rootViewController trouvé: \(type(of: rootViewController))")

        // Configurez AppDataModel avec les options si nécessaire
        if let captureOptions = options {
            print("DEBUG: Options fournies: \(captureOptions)")
            if let modeString = captureOptions["captureMode"] as? String,
               modeString.lowercased() == "area" {
                print("DEBUG: Mode de capture défini sur area")
                AppDataModel.instance.captureMode = .area
            } else {
                print("DEBUG: Mode de capture défini sur object")
                AppDataModel.instance.captureMode = .object
            }
        }

        // Configurez le delegate pour recevoir les callbacks de l'app native
        AppDataModel.instance.completionDelegate = self
        print("DEBUG: Delegate configuré")

        // Créez une vue hôte SwiftUI qui contiendra votre ContentView
        print("DEBUG: Création de ContentView")
        let contentView = ContentView()
        let anyView = AnyView(contentView)
        
        // Créez un contrôleur pour héberger la vue SwiftUI
        print("DEBUG: Création du UIHostingController")
        self.hostingController = UIHostingController(rootView: anyView)
        
        // Configurez le contrôleur
        if let hostingController = self.hostingController {
            hostingController.modalPresentationStyle = .fullScreen
            
            // Présentez le contrôleur de vue
            print("DEBUG: Présentation du hostingController")
            rootViewController.present(hostingController, animated: true) {
                print("DEBUG: hostingController présenté avec succès")
            }
        } else {
            print("DEBUG: Échec de création du hostingController")
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
