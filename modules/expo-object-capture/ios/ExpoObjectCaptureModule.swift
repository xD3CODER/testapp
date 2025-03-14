import ExpoModulesCore
import SwiftUI
import RealityKit
import ObjectiveC
import os

private let logger = Logger()

public struct ExpoGuidedCapture {
    public static let subsystem: String = "expo.modules.guidedcapture"
}

// MARK: - Protocols

protocol AppDataModelFeedbackDelegate: AnyObject {
    func didUpdateFeedback(messages: [String])
}

protocol AppDataModelCompletionDelegate: AnyObject {
    func captureDidComplete(with result: [String: Any])
    func captureDidCancel()
}

// MARK: - Helper Structures

struct CachedValues {
    var isSupported: Bool = false
    var imageCount: Int = 0
}

// MARK: - AppDataModel Extension

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
    func notifyFeedbackDelegate(messages: [String]) {
        if let delegate = feedbackDelegate {
            DispatchQueue.main.async {
                delegate.didUpdateFeedback(messages: messages)
                print("DEBUG: AppDataModel a notifié le delegate avec messages:", messages)
            }
        }
    }

}

// MARK: - Session Cleanup Manager

class SessionCleanupManager {
    static let shared = SessionCleanupManager()
    private let cleanupLock = NSLock()
    private var isCleaningUp = false

    // Cette méthode effectue un nettoyage complet et attend qu'il soit terminé
    @MainActor
    func performFullCleanup() async -> Bool {
        guard cleanupLock.try() else {
            // Un nettoyage est déjà en cours, attendre qu'il se termine
            while isCleaningUp {
                try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconde
            }
            return true
        }

        isCleaningUp = true
        defer {
            isCleaningUp = false
            cleanupLock.unlock()
        }

        do {
            // 1. Nettoyer AppDataModel
            resetAppDataModel()

            // 2. Supprimer les anciennes sessions
            await cleanupOldSessions()

            // 3. Attendre que les ressources système soient libérées
            try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 seconde

            return true
        } catch {
            logger.error("Cleanup failed: \(error)")
            return false
        }
    }

    @MainActor
    private func resetAppDataModel() {
        // Forcer l'état à restart pour déclencher un reset() complet
        if AppDataModel.instance.state != .ready {
            AppDataModel.instance.state = .restart
        }

        // S'assurer que la session est bien annulée
        if let session = AppDataModel.instance.objectCaptureSession {
            session.cancel()
        }

        // Vider les références
        AppDataModel.instance.objectCaptureSession = nil
    }

    @MainActor
    private func cleanupOldSessions() async {
        do {
            let fileManager = FileManager.default
            let documentsDirectory = try fileManager.url(for: .documentDirectory,
                                                        in: .userDomainMask,
                                                        appropriateFor: nil,
                                                        create: true)

            // Récupérer tous les dossiers de capture
            let contents = try fileManager.contentsOfDirectory(at: documentsDirectory,
                                                              includingPropertiesForKeys: nil)
            let captureDirectories = contents.filter { url in
                return url.hasDirectoryPath &&
                      (url.lastPathComponent.contains("Z-") || // Format avec UUID
                       url.lastPathComponent.contains("T") && url.lastPathComponent.contains("Z")) // Format ISO8601
            }

            // Conserver les 3 plus récents seulement
            if captureDirectories.count > 3 {
                let sortedDirectories = captureDirectories.sorted { $0.lastPathComponent > $1.lastPathComponent }
                let directoriesToDelete = sortedDirectories.dropFirst(3)

                for directory in directoriesToDelete {
                    try fileManager.removeItem(at: directory)
                    logger.log("Cleaned up old capture directory: \(directory.lastPathComponent)")
                }
            }

            // Vérifier s'il y a des incohérences
            await detectAndFixInconsistencies(in: documentsDirectory)

        } catch {
            logger.error("Failed to cleanup old sessions: \(error)")
        }
    }

    // Détecte et tente de résoudre les problèmes courants
    private func detectAndFixInconsistencies(in documentsDirectory: URL) async {
        do {
            let fileManager = FileManager.default
            let contents = try fileManager.contentsOfDirectory(at: documentsDirectory,
                                                             includingPropertiesForKeys: nil)

            for url in contents {
                if url.hasDirectoryPath {
                    // Vérifier la structure
                    let imagesFolder = url.appendingPathComponent("Images")
                    let checkpointFolder = url.appendingPathComponent("Checkpoint")
                    let modelsFolder = url.appendingPathComponent("Models")

                    // Si les sous-dossiers existent mais sont vides, on peut supprimer le dossier parent
                    if fileManager.fileExists(atPath: imagesFolder.path) {
                        let imageContents = try? fileManager.contentsOfDirectory(at: imagesFolder,
                                                                               includingPropertiesForKeys: nil)
                        if imageContents?.isEmpty ?? true {
                            // Dossier vide ou inaccessible, on peut le supprimer
                            try? fileManager.removeItem(at: url)
                            logger.log("Removed empty capture directory: \(url.lastPathComponent)")
                            continue
                        }
                    }

                    // Vérifier les permissions
                    let testFile = url.appendingPathComponent("test_access.tmp")
                    do {
                        try "test".write(to: testFile, atomically: true, encoding: .utf8)
                        try fileManager.removeItem(at: testFile)
                    } catch {
                        // Problème de permission, supprimer le dossier
                        logger.error("Permission issue with directory \(url.lastPathComponent), removing it")
                        try? fileManager.removeItem(at: url)
                    }
                }
            }
        } catch {
            logger.error("Error detecting inconsistencies: \(error)")
        }
    }
}

// MARK: - Main Module Class

public class ExpoObjectCaptureModule: Module {
    // MARK: Properties

    // Session partagée pour être utilisée par plusieurs méthodes
    @MainActor private var objectCaptureSession: ObjectCaptureSession?
    @MainActor private var capturePromise: Promise?
    @MainActor private var stateTasks: [Task<Void, Never>] = []
    // Pour suivre l'état et émettre des événements
    @MainActor private var isTrackingState: Bool = false
    @MainActor private var isTrackingFeedback: Bool = false
    @MainActor private var lastReportedState: String = "ready"
    @MainActor private var lastReportedFeedback: [String] = []
    private let sessionCreationLock = NSLock()
    private var isSessionCreationInProgress = false
    @MainActor private var feedbackTimers: [Timer] = []
    @MainActor private var hostingController: UIHostingController<AnyView>?

    // Cache pour les valeurs à accéder de façon synchrone - c'est une variable non-isolée
    private var cachedValues = CachedValues()

    // MARK: - Lifecycle & Event Handlers

    @objc private func handleAppWillResignActive() {
        Task { @MainActor in
            logger.log("App will resign active, cleaning up resources")
            // Nettoyage partiel
            if let session = self.objectCaptureSession {
                if session.state != .capturing && session.state != .finishing {
                    session.cancel()
                }
            }
        }
    }

    @MainActor
    @objc private func handleAppWillTerminate() {
        // Ce code s'exécute de façon synchrone car l'app va être terminée
        logger.log("App will terminate, performing emergency cleanup")
        guard let session = self.objectCaptureSession else {
            print("Aucune session disponible à attacher")
            return
        }
        session.cancel()
    }

    // MARK: - Module Definition

    public func definition() -> ModuleDefinition {
        // Définir le nom du module
        Name("ExpoObjectCapture")

        // Définir les événements
        Events("onStateChanged", "onFeedbackChanged", "onProcessingProgress", "onModelComplete", "onError", "onViewReady")

        // Initialiser après création
        OnCreate {
         
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
        // Dans la méthode AsyncFunction("createCaptureSession")
AsyncFunction("createCaptureSession") { (promise: Promise) in
    Task { @MainActor in
        // Vérifier et verrouiller la création de session
        guard sessionCreationLock.try() else {
            promise.resolve(false)
            return
        }

        do {
            // Effectuer un nettoyage complet avant de créer une nouvelle session
            let cleanupSuccess = await SessionCleanupManager.shared.performFullCleanup()
            if !cleanupSuccess {
                logger.warning("Cleanup was not fully successful, proceeding anyway")
            }

          // AJOUT: Définir la référence au module dans AppDataModel
            AppDataModel.instance.expoModule = self

            // Configurer les delegates
            AppDataModel.instance.completionDelegate = self
            // Créer une nouvelle session
           

            var session = try AppDataModel.instance.startNewCapture()
            // Définir la session et le gestionnaire dans AppDataModel
            self.objectCaptureSession = session
            AppDataModel.instance.objectCaptureSession = session
          
            // Simplifier cette méthode car AppDataModel va gérer les événements
            // Déverrouiller
            sessionCreationLock.unlock()
            promise.resolve(true)

        } catch {
            // En cas d'erreur, déverrouiller
            sessionCreationLock.unlock()

            logger.error("Session creation failed: \(error)")

            // Envoyer un événement d'erreur détaillé
            self.sendEvent("onError", [
                "message": "Impossible de créer la session de capture: \(error.localizedDescription) - Code: \(String(describing: (error as NSError).code))"
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
                    if let captureView = self.findExpoObjectCaptureView(in: window) {
                        captureView.setSession(session)
                        promise.resolve(true)
                        return
                    }
                }
                promise.resolve(false)
            }
        }
        AsyncFunction("navigateToReconstruction") { (promise: Promise) in
            Task { @MainActor in
                // Récupérer toutes les instances de ExpoObjectCaptureView
                for window in UIApplication.shared.windows {
                    if let captureView = self.findExpoObjectCaptureView(in: window) {
                        captureView.setReconstructionView()
                        promise.resolve(true)
                        return
                    }
                }
                promise.resolve(false)
            }
        }

        AsyncFunction("detectObject") { (promise: Promise) in
            Task { @MainActor in
                guard let session = self.objectCaptureSession else {
                    return promise.reject(NSError(domain: "ExpoObjectCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "session is not ready to detectObject"]))
                }
                print("session state ", session.state)
                if session.state == .ready {
                    let detection = session.startDetecting()
                    print("START DETECTING RESULT ", detection)
                    return promise.resolve(detection)
                }
                promise.reject(NSError(domain: "ExpoObjectCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "session is not ready to detectObject"]))
            }
        }

        // Définir une fonction qui peut être appelée depuis React Native pour démarrer la capture
        AsyncFunction("startCapture") { (promise: Promise) in
            Task { @MainActor in
                do {
                    guard let session = self.objectCaptureSession else {
                        return promise.reject(NSError(domain: "ExpoObjectCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "session is not ready to detectObject"]))
                    }
                    session.startCapturing()
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
                    do {
                        // Vérifier que la session existe
                        guard let session = AppDataModel.instance.objectCaptureSession else {
                            promise.reject(NSError(domain: "ExpoObjectCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "No active capture session"]))
                            return
                        }

                        // Trouver le contrôleur de vue visible actuel
                        guard let keyWindow = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) else {
                            promise.reject(NSError(domain: "ExpoObjectCapture", code: 2, userInfo: [NSLocalizedDescriptionKey: "No active window found"]))
                            return
                        }

                        var topController = keyWindow.rootViewController
                        while let presentedController = topController?.presentedViewController {
                            topController = presentedController
                        }

                        guard let topController = topController else {
                            promise.reject(NSError(domain: "ExpoObjectCapture", code: 3, userInfo: [NSLocalizedDescriptionKey: "No visible controller found"]))
                            return
                        }

                        // Utiliser determineCurrentOnboardingState pour obtenir l'état correct
                        guard let initialState = AppDataModel.instance.determineCurrentOnboardingState() else {
                            promise.reject(NSError(domain: "ExpoObjectCapture", code: 4, userInfo: [NSLocalizedDescriptionKey: "Cannot determine onboarding state"]))
                            return
                        }

                        // Créer une variable bindable pour gérer la présentation
                        @State var showOnboardingView = true

                        // Créer la vue d'onboarding avec l'état déterminé dynamiquement
                        let onboardingView = OnboardingView(
                            state: initialState,
                            showOnboardingView: Binding(
                                get: { showOnboardingView },
                                set: { newValue in
                                    showOnboardingView = newValue
                                    if !newValue {
                                        // Fermer le sheet si nécessaire
                                        topController.dismiss(animated: true, completion: nil)
                                    }
                                }
                            )
                        )
                        .environment(AppDataModel.instance)
                        .environment(session)  // Ajouter explicitement la session à l'environnement

                        let hostingController = UIHostingController(rootView: AnyView(onboardingView))
                        hostingController.modalPresentationStyle = .fullScreen

                        topController.present(hostingController, animated: true) {
                            promise.resolve(true)
                        }
                    } catch {
                        promise.reject(error)
                    }
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

    // MARK: - Utility Methods

    private func updateCachedValue(_ update: (inout CachedValues) -> Void) {
        var newValues = self.cachedValues
        update(&newValues)
        self.cachedValues = newValues
    }

    private func createCaptureFolderWithRetry(maxRetries: Int = 3) async throws -> CaptureFolderManager {
        var retryCount = 0
        var lastError: Error?

        while retryCount < maxRetries {
            do {
                let folderManager = try CaptureFolderManager()
                return folderManager
            } catch {
                lastError = error
                retryCount += 1
                logger.warning("Failed to create capture folder, retry \(retryCount)/\(maxRetries): \(error)")

                // Attendre plus longtemps à chaque tentative (backoff exponentiel)
                let delayInNanoseconds = UInt64(pow(2.0, Double(retryCount))) * 500_000_000
                try await Task.sleep(nanoseconds: delayInNanoseconds)
            }
        }

        logger.error("All attempts to create capture folder failed")
        throw lastError ?? CaptureFolderManager.Error.creationFailed
    }

    // MARK: - Cache Initialization

    @MainActor
    private func initializeCache() {
        // Vérifier si ObjectCaptureSession est supporté
        let isSupported = ObjectCaptureSession.isSupported
        self.updateCachedValue { $0.isSupported = isSupported }

        print("DEBUG: Bridge de feedback configuré dans initializeCache")

        // Initialiser les autres valeurs de cache
        self.updateCachedValue { values in
           
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

    // MARK: - Session Tracking

@MainActor
private func startTrackingSessionUpdates(session: ObjectCaptureSession) {
    print("DEBUG: Utilisation d'AppDataModel pour le suivi des mises à jour de session")

    // AppDataModel gère déjà les événements, nous établissons simplement la référence
    AppDataModel.instance.expoModule = self

    // Mettre à jour les valeurs en cache initiales
    updateCachedValue { values in
        values.imageCount = session.numberOfShotsTaken
    }
}

// Helper pour convertir l'état de session en chaîne
func convertSessionStateToString(_ state: ObjectCaptureSession.CaptureState) -> String {
    switch state {
    case .initializing: return "initializing"
    case .ready: return "ready"
    case .detecting: return "detecting"
    case .capturing: return "capturing"
    case .finishing: return "finishing"
    case .completed: return "completed"
    case .failed: return "failed"
    @unknown default: return "unknown"
    }
}


    // MARK: - View Attachment & Presentation

    @MainActor
    private func findExpoObjectCaptureView(in view: UIView) -> ExpoObjectCaptureView? {
        print("DEBUG: Recherche de vues pour attacher la session dans \(view)")
        if let captureView = view as? ExpoObjectCaptureView {
            print("DEBUG: Vue ExpoObjectCaptureView trouvée, attachement de la session")
            return captureView
        }

        for subview in view.subviews {
           return findExpoObjectCaptureView(in: subview)
        }
        
        return nil
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

    @MainActor
    private func dismissViewController() {
        if let rootViewController = UIApplication.shared.windows.first?.rootViewController,
           let presentedViewController = rootViewController.presentedViewController {
            presentedViewController.dismiss(animated: true, completion: nil)
        }
    }
}

// MARK: - AppDataModelCompletionDelegate Implementation

// MARK: - AppDataModelCompletionDelegate Implementation

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
}
