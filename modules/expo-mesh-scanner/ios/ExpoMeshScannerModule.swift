// ExpoMeshScannerModule.swift
import ExpoModulesCore
import RealityKit
import SwiftUI
import Combine

@available(iOS 17.4, *)
public class ExpoMeshScannerModule: Module {
    // ObjectCapture session
    private var captureSession: ObjectCaptureSession?
    private var photogrammetrySession: PhotogrammetrySession?
    private var cancellables = Set<AnyCancellable>()
    private var tasks: [Task<Void, Never>] = []
    // Définition du module

    public func definition() -> ModuleDefinition {
        Name("ExpoMeshScanner")

        // Événements
        Events(
            "onScanStateChanged",
            "onFeedbackUpdated",
            "onScanComplete",
            "onScanError",
            "onReconstructionProgress",
            "onReconstructionComplete",
            "onObjectDetected"
        )

        // Vue
        View(ExpoMeshScannerView.self) {
            Prop("session") { (view: ExpoMeshScannerView, value: Bool) in
                if #available(iOS 17.0, *), value, let session = self.captureSession {
                    view.setSession(session)
                }
            }
        }

        // Nettoyage des dossiers de scan
        Function("cleanScanDirectories") {
            do {
                let fileManager = FileManager.default
                let documentsDir = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!

                // Supprimer les anciens scans si nécessaire
                // Implémentation simplifiée - à améliorer selon vos besoins
                let contents = try fileManager.contentsOfDirectory(at: documentsDir, includingPropertiesForKeys: nil)
                for url in contents where url.hasDirectoryPath {
                    if url.lastPathComponent != "Models" {
                        try? fileManager.removeItem(at: url)
                    }
                }

                return true
            } catch {
                print("Error cleaning scan directories: \(error)")
                return false
            }
        }

        // Vérifier le support de l'appareil
        AsyncFunction("checkSupport") { (promise: Promise) in
            // Exécuter sur le MainActor
            Task { @MainActor in
                if #available(iOS 17.0, *) {
                    let isSupported = ObjectCaptureSession.isSupported

                    promise.resolve([
                        "supported": isSupported,
                        "reason": isSupported ? "" : "This device doesn't support Object Capture"
                    ])
                } else {
                    promise.resolve([
                        "supported": false,
                        "reason": "iOS 17 or later is required for Object Capture"
                    ])
                }
            }
        }

        // Démarrer un nouveau scan
        AsyncFunction("startScan") { (options: [String: Any]?, promise: Promise) in
                    if #available(iOS 17.0, *) {
                        Task { @MainActor in
                            guard ObjectCaptureSession.isSupported else {
                                promise.reject(Exception(name: "device_not_supported", description: "This device doesn't support Object Capture"))
                                return
                            }

                DispatchQueue.main.async {
                    do {
                        // Créer les dossiers de capture
                        let manager = ScanProcessManager.shared
                        let (imagesDir, checkpointsDir, _) = try manager.createCaptureDirectories()

                        // Configurer la session
                        var configuration = ObjectCaptureSession.Configuration()
                        configuration.checkpointDirectory = checkpointsDir

                        // Extraire les options
                        if let options = options {
                            if let captureMode = options["captureMode"] as? String {
                                manager.captureMode = captureMode == "area" ? .area : .object
                            }

                            if let overCapture = options["enableOverCapture"] as? Bool {
                                configuration.isOverCaptureEnabled = overCapture
                            }
                        }

                        // Créer et démarrer la session
                        let session = ObjectCaptureSession()
                        self.captureSession = session
                        self.setupSessionObservers()

                        session.start(imagesDirectory: imagesDir, configuration: configuration)
                        manager.currentState = .ready

                        self.sendEvent("onScanStateChanged", ["state": "ready"])
                        promise.resolve([
                            "success": true,
                            "imagesPath": imagesDir.path
                        ])
                    } catch {
                        promise.reject(Exception(name: "start_scan_error", description: error.localizedDescription))
                    }
                }
                        }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }

        // Passer en mode détection
        AsyncFunction("startDetecting") { (promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.main.async {
                    guard let session = self.captureSession else {
                        promise.reject(Exception(name: "session_not_found", description: "Capture session not initialized"))
                        return
                    }

                    if ScanProcessManager.shared.currentState == .ready {
                        session.startDetecting()
                        ScanProcessManager.shared.currentState = .detecting
                        self.sendEvent("onScanStateChanged", ["state": "detecting"])
                        promise.resolve(["success": true])
                    } else {
                        promise.reject(Exception(name: "invalid_state", description: "Session is not in ready state"))
                    }
                }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }

        // Ajuster les dimensions de l'objet (nouveau)
        AsyncFunction("updateObjectDimensions") { (dimensions: [String: Float], promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.main.async {
                    let manager = ScanProcessManager.shared

                    if let width = dimensions["width"] {
                        manager.objectDimensions.width = width
                    }

                    if let height = dimensions["height"] {
                        manager.objectDimensions.height = height
                    }

                    if let depth = dimensions["depth"] {
                        manager.objectDimensions.depth = depth
                    }

                    promise.resolve(["success": true])
                }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }

        // Passer en mode capture
        AsyncFunction("startCapturing") { (promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.main.async {
                    guard let session = self.captureSession else {
                        promise.reject(Exception(name: "session_not_found", description: "Capture session not initialized"))
                        return
                    }

                    if ScanProcessManager.shared.currentState == .detecting ||
                       ScanProcessManager.shared.currentState == .objectDetected {
                        session.startCapturing()
                        ScanProcessManager.shared.currentState = .capturing
                        self.sendEvent("onScanStateChanged", ["state": "capturing"])
                        promise.resolve(["success": true])
                    } else {
                        promise.reject(Exception(name: "invalid_state", description: "Session is not in detecting state"))
                    }
                }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }

        // Terminer le scan
        AsyncFunction("finishScan") { (promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.main.async {
                    guard let session = self.captureSession else {
                        promise.reject(Exception(name: "session_not_found", description: "Capture session not initialized"))
                        return
                    }

                    if ScanProcessManager.shared.currentState == .capturing {
                        session.finish()
                        ScanProcessManager.shared.currentState = .processing
                        self.sendEvent("onScanStateChanged", ["state": "processing"])
                        promise.resolve(["success": true])
                    } else {
                        promise.reject(Exception(name: "invalid_state", description: "Session is not in capturing state"))
                    }
                }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }

        // Annuler le scan
        AsyncFunction("cancelScan") { (promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.main.async {
                    guard let session = self.captureSession else {
                        promise.resolve(["success": true]) // Déjà annulé ou non démarré
                        return
                    }

                    session.cancel()
                    self.captureSession = nil
                    self.photogrammetrySession = nil

                    ScanProcessManager.shared.currentState = .notStarted
                    self.sendEvent("onScanStateChanged", ["state": "notStarted"])
                    promise.resolve(["success": true])
                }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }

        // Reconstruire le modèle 3D
        AsyncFunction("reconstructModel") { (options: [String: Any]?, promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.global(qos: .userInitiated).async {
                    let manager = ScanProcessManager.shared

                    guard let imagesFolder = manager.imagesFolder,
                          let modelsFolder = manager.modelsFolder,
                          let checkpointFolder = manager.checkpointFolder else {
                        promise.reject(Exception(name: "folders_not_set", description: "Scan folders not properly set"))
                        return
                    }

                    do {
                        let modelURL = modelsFolder.appendingPathComponent("model_\(Int(Date().timeIntervalSince1970)).usdz")
                        let previewURL = modelsFolder.appendingPathComponent("preview_\(Int(Date().timeIntervalSince1970)).jpg")

                        // Configurer la photogrammétrie
                        var configuration = PhotogrammetrySession.Configuration()
                        configuration.checkpointDirectory = checkpointFolder

                        configuration.featureSensitivity = .high

                        // Masquage d'objet basé sur le mode
                        configuration.isObjectMaskingEnabled = manager.captureMode == .object

                        // Créer la session photogrammétrie
                        let photoSession = try PhotogrammetrySession(
                            input: imagesFolder,
                            configuration: configuration
                        )
                        self.photogrammetrySession = photoSession

                        // Démarrer le traitement
                        Task {
                            do {
                                // Traiter avec demande de fichier modèle
                                try photoSession.process(requests: [
                                    .modelFile(url: modelURL)
                                ])

                                // Suivre la progression
                                for try await output in photoSession.outputs {
                                    switch output {
                                        case .processingComplete:
                                            // Générer une image d'aperçu simple
                                            Task {
                                                await self.generatePreviewImage(from: imagesFolder, to: previewURL)
                                            }

                                            DispatchQueue.main.async {
                                                manager.currentState = .finished
                                                self.sendEvent("onScanStateChanged", ["state": "finished"])
                                                self.sendEvent("onReconstructionComplete", [
                                                    "success": true,
                                                    "modelPath": modelURL.path,
                                                    "previewPath": previewURL.path
                                                ])

                                                promise.resolve([
                                                    "success": true,
                                                    "modelPath": modelURL.path,
                                                    "previewPath": previewURL.path
                                                ])
                                            }

                                        case .processingCancelled:
                                            DispatchQueue.main.async {
                                                promise.reject(Exception(name: "reconstruction_cancelled", description: "Reconstruction was cancelled"))
                                            }

                                        case .requestProgress(_, let fraction):
                                            DispatchQueue.main.async {
                                                self.sendEvent("onReconstructionProgress", [
                                                    "progress": fraction,
                                                    "stage": "Processing \(Int(fraction * 100))%"
                                                ])
                                            }

                                        case .requestError(_, let error):
                                            DispatchQueue.main.async {
                                                manager.currentState = .error
                                                manager.error = error
                                                self.sendEvent("onScanStateChanged", ["state": "error"])
                                                self.sendEvent("onScanError", ["message": error.localizedDescription])

                                                promise.reject(Exception(name: "reconstruction_error", description: error.localizedDescription))
                                            }

                                        default:
                                            break
                                    }
                                }
                            } catch {
                                DispatchQueue.main.async {
                                    manager.currentState = .error
                                    manager.error = error
                                    self.sendEvent("onScanStateChanged", ["state": "error"])
                                    self.sendEvent("onScanError", ["message": error.localizedDescription])
                                    promise.reject(Exception(name: "reconstruction_error", description: error.localizedDescription))
                                }
                            }
                        }
                    } catch {
                        DispatchQueue.main.async {
                            manager.currentState = .error
                            manager.error = error
                            self.sendEvent("onScanStateChanged", ["state": "error"])
                            self.sendEvent("onScanError", ["message": error.localizedDescription])
                            promise.reject(Exception(name: "reconstruction_error", description: error.localizedDescription))
                        }
                    }
                }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }

        // Récupérer l'état actuel du scan
        Function("getScanState") {
            let manager = ScanProcessManager.shared
            return [
                "state": manager.currentState.rawValue,
                "captureMode": manager.captureMode.rawValue,
                "dimensions": [
                    "width": manager.objectDimensions.width,
                    "height": manager.objectDimensions.height,
                    "depth": manager.objectDimensions.depth
                ],
                "hasPosition": manager.objectPosition != nil
            ]
        }
    }

    // MARK: - Private methods
    @available(iOS 17.4, *)
    private func setupSessionObservers() {
        guard let session = captureSession else { return }

        // Observer pour les mises à jour d'état
        tasks.append(
            Task<Void, Never> { [weak self] in
                for await newState in await session.stateUpdates {
                    guard let self = self else { continue }

                    DispatchQueue.main.async {
                        switch newState {
                            case .completed:
                                ScanProcessManager.shared.currentState = .completed
                                self.sendEvent("onScanStateChanged", ["state": "completed"])
                                self.sendEvent("onScanComplete", [:])

                            case .failed(let error):
                                ScanProcessManager.shared.currentState = .error
                                ScanProcessManager.shared.error = error
                                self.sendEvent("onScanStateChanged", ["state": "error"])
                                self.sendEvent("onScanError", ["message": error.localizedDescription])

                            default:
                                break
                        }
                    }
                }
            })

        // Observer pour le feedback
        tasks.append(
            Task<Void, Never> { [weak self] in
                for await feedback in await session.feedbackUpdates {
                    guard let self = self else { continue }

                    DispatchQueue.main.async {
                        var feedbackMessages: [String] = []

                        if feedback.contains(.objectTooFar) {
                            feedbackMessages.append("Move closer to the object")
                        }
                        if feedback.contains(.objectTooClose) {
                            feedbackMessages.append("Move farther from the object")
                        }
                        if feedback.contains(.movingTooFast) {
                            feedbackMessages.append("Move more slowly")
                        }
                        if feedback.contains(.environmentTooDark) {
                            feedbackMessages.append("Environment is too dark")
                        }

                        self.sendEvent("onFeedbackUpdated", [
                            "messages": feedbackMessages,
                            "hasObjectFeedback": !feedback.isEmpty
                        ])

                        // Détecter quand l'objet est détecté
                        if case .detecting = session.state, !feedback.contains(.objectNotDetected) {
                            ScanProcessManager.shared.currentState = .objectDetected
                            self.sendEvent("onScanStateChanged", ["state": "objectDetected"])
                            self.sendEvent("onObjectDetected", [:])
                        }
                    }
                }
            })
    }

    private func generatePreviewImage(from sourceDir: URL, to destinationURL: URL) async {
        // Simple génération d'aperçu en utilisant la première image du dossier
        let fileManager = FileManager.default

        do {
            let contents = try fileManager.contentsOfDirectory(at: sourceDir, includingPropertiesForKeys: nil)
            let imageFiles = contents.filter { $0.pathExtension.lowercased() == "heic" }

            if let firstImage = imageFiles.first {
                try fileManager.copyItem(at: firstImage, to: destinationURL)
            }
        } catch {
            print("Error generating preview image: \(error)")
        }
    }
}
