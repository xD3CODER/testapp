import ExpoModulesCore
import RealityKit
import SwiftUI

@MainActor
public class ExpoObjectCaptureModule: Module {
    // Propriétés de l'ancien AppDataModel intégrées directement
    private var objectCaptureSession: ObjectCaptureSession?
    private var photogrammetrySession: PhotogrammetrySession?
    private var captureFolderManager: CaptureFolderManager?
    private var state: CaptureState = .ready
    private var error: Error?
    private var isSaveDraftEnabled = false
    private var messageList = TimedMessageList()
    private var tasks: [Task<Void, Never>] = []
    private var currentFeedback: Set<ObjectCaptureSession.Feedback> = []
    
    // États de capture pour notre module
    enum CaptureState: String {
        case notSet
        case ready
        case capturing
        case prepareToReconstruct
        case reconstructing
        case viewing
        case completed
        case restart
        case failed
    }
    
    // Définition du module Expo
    public func definition() -> ModuleDefinition {
        Name("ExpoObjectCapture")
        
        // Événements envoyés à JavaScript
        Events(
            "onStateChanged",
            "onFeedbackChanged",
            "onProcessingProgress",
            "onModelComplete", 
            "onError"
        )
        
        // Vue native
        View(ExpoObjectCaptureView.self) {
            // Passer une référence à ce module lors de la création de la vue
            OnCreate { view in
                view.module = self
            }
        }
        
        // === MÉTHODES EXPOSÉES À JAVASCRIPT ===
        
        // Vérifier si l'appareil est compatible
        Function("isSupported") {
            if #available(iOS 17.0, *) {
                return ObjectCaptureSession.isSupported
            }
            return false
        }
        
        // Démarrer une nouvelle capture
        AsyncFunction("startNewCapture") { (promise: Promise) in
            do {
                try self.startNewCapture()
                promise.resolve(true)
            } catch {
                promise.reject("capture_error", error.localizedDescription)
            }
        }
        
        // Démarrer la détection d'objet
        AsyncFunction("startDetecting") { (promise: Promise) in
            guard let session = self.objectCaptureSession else {
                promise.reject("no_session", "No active capture session")
                return
            }
            
            let result = session.startDetecting()
            promise.resolve(result)
        }
        
        // Démarrer la capture
        AsyncFunction("startCapturing") { (promise: Promise) in
            guard let session = self.objectCaptureSession else {
                promise.reject("no_session", "No active capture session")
                return
            }
            
            session.startCapturing()
            promise.resolve(true)
        }
        
        // Terminer la capture
        AsyncFunction("finishCapture") { (promise: Promise) in
            guard let session = self.objectCaptureSession else {
                promise.reject("no_session", "No active capture session")
                return
            }
            
            session.finish()
            promise.resolve(true)
        }
        
        // Annuler la capture
        AsyncFunction("cancelCapture") { (promise: Promise) in
            guard let session = self.objectCaptureSession else {
                promise.resolve(true) // Rien à annuler
                return
            }
            
            session.cancel()
            self.objectCaptureSession = nil
            self.removeCaptureFolder()
            self.switchState(to: .ready)
            promise.resolve(true)
        }
        
        // Démarrer la reconstruction 3D
        AsyncFunction("startReconstruction") { (promise: Promise) in
            do {
                try self.startReconstruction()
                promise.resolve(true)
            } catch {
                promise.reject("reconstruction_error", error.localizedDescription)
            }
        }
        
        // Obtenir l'état actuel
        Function("getCurrentState") {
            return ["state": self.state.rawValue]
        }
        
        // Obtenir le nombre d'images capturées
        Function("getImageCount") {
            return self.objectCaptureSession?.numberOfShotsTaken ?? 0
        }
    }
    
    // === FONCTIONS DE L'ANCIEN APPDATA MODEL ===
    
    // Démarre une nouvelle capture
    private func startNewCapture() throws {
        if !ObjectCaptureSession.isSupported {
            throw NSError(domain: "ExpoObjectCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "ObjectCaptureSession is not supported on this device"])
        }
        
        captureFolderManager = try CaptureFolderManager()
        objectCaptureSession = ObjectCaptureSession()
        
        guard let session = objectCaptureSession else {
            throw NSError(domain: "ExpoObjectCapture", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to create ObjectCaptureSession"])
        }
        
        guard let captureFolderManager else {
            throw NSError(domain: "ExpoObjectCapture", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to create folder manager"])
        }
        
        var configuration = ObjectCaptureSession.Configuration()
        configuration.isOverCaptureEnabled = true
        configuration.checkpointDirectory = captureFolderManager.checkpointFolder
        
        session.start(imagesDirectory: captureFolderManager.imagesFolder,
                     configuration: configuration)
        
        if case let .failed(error) = session.state {
            throw error
        } else {
            switchState(to: .capturing)
            attachListeners()
        }
    }
    
    // Démarre la reconstruction 3D
    private func startReconstruction() throws {
        var configuration = PhotogrammetrySession.Configuration()
        configuration.isObjectMaskingEnabled = true
        
        guard let captureFolderManager else {
            throw NSError(domain: "ExpoObjectCapture", code: 4, userInfo: [NSLocalizedDescriptionKey: "captureFolderManager is nil"])
        }
        
        configuration.checkpointDirectory = captureFolderManager.checkpointFolder
        photogrammetrySession = try PhotogrammetrySession(
            input: captureFolderManager.imagesFolder,
            configuration: configuration)
        
        switchState(to: .reconstructing)
        
        // Observer la progression de la reconstruction
        Task {
            await self.observeReconstructionProgress()
        }
    }
    
    // Change l'état du module
    private func switchState(to newState: CaptureState) {
        if state == newState { return }
        
        // Logique de transition entre états
        switch newState {
            case .prepareToReconstruct:
                objectCaptureSession = nil
            case .restart, .completed:
                reset()
            case .viewing:
                photogrammetrySession = nil
                removeCheckpointFolder()
            case .failed:
                sendEvent("onError", ["message": error?.localizedDescription ?? "Unknown error"])
            default:
                break
        }
        
        state = newState
        sendEvent("onStateChanged", ["state": state.rawValue])
    }
    
    // Réinitialise le module
    private func reset() {
        photogrammetrySession = nil
        objectCaptureSession = nil
        captureFolderManager = nil
        currentFeedback = []
        state = .ready
    }
    
    // Supprime le dossier de capture
    private func removeCaptureFolder() {
        guard let url = captureFolderManager?.captureFolder else { return }
        try? FileManager.default.removeItem(at: url)
    }
    
    // Supprime le dossier de checkpoint
    private func removeCheckpointFolder() {
        if let captureFolderManager {
            DispatchQueue.global(qos: .background).async {
                try? FileManager.default.removeItem(at: captureFolderManager.checkpointFolder)
            }
        }
    }
    
    // Attache les observateurs à la session
    private func attachListeners() {
        guard let session = objectCaptureSession else { return }
        
        // Observer les changements d'état
        tasks.append(
            Task { [weak self] in
                for await newState in session.stateUpdates {
                    guard let self = self else { continue }
                    
                    switch newState {
                        case .completed:
                            self.switchState(to: .prepareToReconstruct)
                        case .failed(let error):
                            self.error = error
                            self.switchState(to: .failed)
                        default:
                            break
                    }
                }
            }
        )
        
        // Observer les feedbacks
        tasks.append(
            Task { [weak self] in
                for await feedback in session.feedbackUpdates {
                    guard let self = self else { continue }
                    self.updateFeedback(feedback)
                }
            }
        )
    }
    
    // Met à jour les messages de feedback
    private func updateFeedback(_ feedback: Set<ObjectCaptureSession.Feedback>) {
        var feedbackMessages: [String] = []
        
        // Convertir les feedback en messages lisibles
        for item in feedback {
            if let message = FeedbackMessages.getFeedbackString(for: item, captureMode: .object) {
                feedbackMessages.append(message)
            }
        }
        
        currentFeedback = feedback
        sendEvent("onFeedbackChanged", ["messages": feedbackMessages])
    }
    
    // Observe la progression de la reconstruction
    @available(iOS 17.0, *)
    private func observeReconstructionProgress() async {
        guard let session = self.photogrammetrySession else { return }
        
        do {
            // Préparer le chemin du modèle
            let modelPath = captureFolderManager?.modelsFolder.appendingPathComponent("model-mobile.usdz")
            guard let modelPath else { return }
            
            // Lancer la reconstruction
            try session.process(requests: [.modelFile(url: modelPath)])
            
            // Suivre la progression
            for await output in UntilProcessingCompleteFilter(input: session.outputs) {
                switch output {
                    case .requestProgress(let request, fractionComplete: let fractionComplete):
                        if case .modelFile = request {
                            sendEvent("onProcessingProgress", [
                                "progress": fractionComplete
                            ])
                        }
                    case .requestProgressInfo(let request, let progressInfo):
                        if case .modelFile = request {
                            sendEvent("onProcessingProgress", [
                                "progress": progressInfo.fractionComplete,
                                "stage": progressInfo.processingStage?.processingStageString ?? "Processing",
                                "timeRemaining": progressInfo.estimatedRemainingTime ?? 0
                            ])
                        }
                    case .requestComplete(let request, _):
                        if case .modelFile = request {
                            // Créer un aperçu à partir d'une image capturée
                            var previewPath = ""
                            if let imagesFolder = captureFolderManager?.imagesFolder {
                                if let firstImage = try? FileManager.default.contentsOfDirectory(at: imagesFolder, includingPropertiesForKeys: nil).first(where: { $0.pathExtension.lowercased() == "heic" }) {
                                    previewPath = firstImage.path
                                }
                            }
                            
                            sendEvent("onModelComplete", [
                                "modelPath": modelPath.path,
                                "previewPath": previewPath
                            ])
                            
                            switchState(to: .viewing)
                        }
                    case .processingComplete:
                        break // Déjà géré par requestComplete
                    case .processingCancelled:
                        switchState(to: .restart)
                    case .requestError(_, let error):
                        self.error = error
                        switchState(to: .failed)
                    default:
                        break
                }
            }
        } catch {
            self.error = error
            switchState(to: .failed)
        }
    }
}