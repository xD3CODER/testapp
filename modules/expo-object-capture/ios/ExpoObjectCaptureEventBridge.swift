import ExpoModulesCore
import RealityKit
import SwiftUI
import Foundation
import os


/// Module dédié à la gestion des événements entre iOS et JavaScript
@available(iOS 18.0, *)
public class ExpoObjectCaptureEventBridge {
    private let logger = Logger(subsystem: ExpoGuidedCapture.subsystem, category: "EventBridge")
    private weak var module: ExpoObjectCaptureModule?

    // Variables de l'état actuel pour éviter la duplication d'événements
    private var lastReportedState: String?
    private var lastReportedFeedbackSet: Set<ObjectCaptureSession.Feedback> = []
    private var lastReportedFeedbackMessages: [String] = []
    private var lastReportedProgress: Float = 0

    // Tâches de surveillance des événements
    private var stateContinuation: AsyncStream<ObjectCaptureSession.CaptureState>.Continuation?
    private var feedbackContinuation: AsyncStream<Set<ObjectCaptureSession.Feedback>>.Continuation?
    private var stateMonitorTask: Task<Void, Never>?
    private var feedbackMonitorTask: Task<Void, Never>?

    // Queue pour l'exécution des événements
    private let eventQueue = DispatchQueue(label: "expo.objectcapture.eventQueue", qos: .userInteractive)

    // Dictionary pour convertir les types natifs en chaînes pour JavaScript
    private let stateStringMap: [String: String] = [
        "initializing": "initializing",
        "ready": "ready",
        "detecting": "detecting",
        "capturing": "capturing",
        "finishing": "finishing",
        "completed": "completed",
        "failed": "failed"
    ]

    /// Initialisation du bridge d'événements
    /// - Parameter module: Le module Expo qui enverra les événements à JavaScript
    init(module: ExpoObjectCaptureModule) {
        self.module = module
        logger.debug("Event bridge initialized")
    }

    /// Configuration du suivi des événements pour une session de capture d'objet
    /// - Parameter session: La session à surveiller
    func setupEventTracking(for session: ObjectCaptureSession) {
        logger.debug("Setting up event tracking for session")

        // Annuler les tâches existantes
        cleanup()

        // Créer des streams pour les événements d'état et de feedback
        setupStateTracking(for: session)
        setupFeedbackTracking(for: session)
    }

    /// Nettoyage des ressources de surveillance
    func cleanup() {
        logger.debug("Cleaning up event tracking resources")

        // Arrêter les tâches en cours
        stateMonitorTask?.cancel()
        feedbackMonitorTask?.cancel()

        // Libérer les continuations
        stateContinuation?.finish()
        feedbackContinuation?.finish()

        // Réinitialiser les variables d'état
        lastReportedState = nil
        lastReportedFeedbackSet = []
        lastReportedFeedbackMessages = []
        lastReportedProgress = 0
    }

    // MARK: - Configuration du suivi des événements

    private func setupStateTracking(for session: ObjectCaptureSession) {
        // Créer un stream pour les événements d'état
        let stateStream = AsyncStream<ObjectCaptureSession.CaptureState> { continuation in
            self.stateContinuation = continuation
        }

        // Surveiller les changements d'état
        stateMonitorTask = Task { [weak self] in
            guard let self = self else { return }

            do {
                // Utiliser le stream natif de la session pour suivre les mises à jour d'état
                for await newState in await session.stateUpdates {
                    guard !Task.isCancelled else { break }

                    // Propager l'état au stream
                    self.stateContinuation?.yield(newState)

                    // Traiter et envoyer l'événement
                    self.sendStateChangeEvent(newState)

                    // Gérer l'état de complétion ou d'échec
                    await self.handleCompletionOrFailure(newState, session: session)
                }
            } catch {
                self.logger.error("Erreur dans le suivi des états: \(error)")
            }

            // Si on sort de la boucle, essayer de redémarrer le suivi après un délai
            if !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 seconde
                self.setupStateTracking(for: session)
            }
        }
    }

    private func setupFeedbackTracking(for session: ObjectCaptureSession) {
        // Créer un stream pour les événements de feedback
        let feedbackStream = AsyncStream<Set<ObjectCaptureSession.Feedback>> { continuation in
                  self.feedbackContinuation = continuation
        }
        // Surveiller les changements de feedback
        feedbackMonitorTask = Task { [weak self] in
            guard let self = self else { return }

            do {
                // Utiliser le stream natif de la session pour suivre les mises à jour de feedback
                for await newFeedback in await session.feedbackUpdates {
                    guard !Task.isCancelled else { break }

                    // Propager le feedback au stream
                    self.feedbackContinuation?.yield(newFeedback)

                    // Traiter et envoyer l'événement
                    await self.sendFeedbackChangeEvent(newFeedback)
                }
            } catch {
                self.logger.error("Erreur dans le suivi des feedbacks: \(error)")
            }

            // Si on sort de la boucle, essayer de redémarrer le suivi après un délai
            if !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 seconde
                self.setupFeedbackTracking(for: session)
            }
        }
    }

    // MARK: - Envoi des événements

    /// Envoie un événement de changement d'état à JavaScript
    /// - Parameter state: Le nouvel état de la session
    private func sendStateChangeEvent(_ state: ObjectCaptureSession.CaptureState) {
        let stateString = getStateString(state)

        // Éviter les doublons d'événements inutiles
        if lastReportedState != stateString {
            lastReportedState = stateString

            // Envoyer l'événement sur le thread principal
            DispatchQueue.main.async { [weak self] in
                guard let self = self, let module = self.module else { return }

                module.sendEvent("onStateChanged", [
                    "state": stateString
                ])
                self.logger.debug("Événement d'état envoyé: \(stateString)")
            }
        }
    }

    /// Envoie un événement de changement de feedback à JavaScript
    /// - Parameter feedback: Le nouveau feedback de la session
    private func sendFeedbackChangeEvent(_ feedback: Set<ObjectCaptureSession.Feedback>) async  {
        // Ne pas dupliquer les événements si le feedback n'a pas changé
        if lastReportedFeedbackSet == feedback {
            return
        }

        lastReportedFeedbackSet = feedback

        // Convertir le feedback en messages lisibles
        var messages: [String] = []

        // Utiliser le MainActor pour accéder à AppDataModel.instance.captureMode
        let currentCaptureMode = await MainActor.run { () -> AppDataModel.CaptureMode in
            return AppDataModel.instance.captureMode
        }

        for item in feedback {
            // Attendre la valeur sur le thread principal
            let semaphore = DispatchSemaphore(value: 0)
            var feedbackString: String? = nil
            
            DispatchQueue.main.async {
                feedbackString = FeedbackMessages.getFeedbackString(for: item, captureMode: AppDataModel.instance.captureMode)
                semaphore.signal()
            }
            
            semaphore.wait()
            
            if let message = feedbackString {
                messages.append(message)
            }
        }

        // Éviter les doublons de messages identiques
        if Set(messages) == Set(lastReportedFeedbackMessages) {
            return
        }

        lastReportedFeedbackMessages = messages

        // Envoyer l'événement sur le thread principal
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let module = self.module else { return }

            module.sendEvent("onFeedbackChanged", [
                "messages": messages
            ])
            self.logger.debug("Événement feedback envoyé: \(messages)")
        }
    }

    /// Envoie un événement de progression à JavaScript
    /// - Parameters:
    ///   - progress: La progression actuelle (0.0 - 1.0)
    ///   - stage: L'étape de traitement actuelle
    ///   - timeRemaining: Le temps restant estimé
    func sendProgressEvent(progress: Float, stage: String? = nil, timeRemaining: TimeInterval? = nil) {
        // Éviter les mises à jour de progression trop fréquentes (moins de 1% de différence)
        if abs(progress - lastReportedProgress) < 0.01 {
            return
        }

        lastReportedProgress = progress

        // Préparer les données de l'événement
        var eventData: [String: Any] = ["progress": progress]

        if let stage = stage {
            eventData["stage"] = stage
        }

        if let timeRemaining = timeRemaining {
            eventData["timeRemaining"] = timeRemaining
        }

        // Envoyer l'événement sur le thread principal
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let module = self.module else { return }

            module.sendEvent("onProcessingProgress", eventData)
            self.logger.debug("Événement de progression envoyé: \(progress)")
        }
    }

    /// Envoie un événement de complétion du modèle à JavaScript
    /// - Parameters:
    ///   - modelPath: Le chemin du fichier modèle
    ///   - previewPath: Le chemin du fichier de prévisualisation
    func sendModelCompleteEvent(modelPath: String, previewPath: String) {
        // Envoyer l'événement sur le thread principal
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let module = self.module else { return }

            module.sendEvent("onModelComplete", [
                "modelPath": modelPath,
                "previewPath": previewPath
            ])
            self.logger.debug("Événement de complétion du modèle envoyé")
        }
    }

    /// Envoie un événement d'erreur à JavaScript
    /// - Parameter error: L'erreur survenue
    func sendErrorEvent(_ error: Error) {
        // Envoyer l'événement sur le thread principal
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let module = self.module else { return }

            module.sendEvent("onError", [
                "message": error.localizedDescription
            ])
            self.logger.error("Événement d'erreur envoyé: \(error.localizedDescription)")
        }
    }

    // MARK: - Utilitaires

    /// Gère l'état de complétion ou d'échec d'une session
    /// - Parameters:
    ///   - state: L'état actuel de la session
    ///   - session: La session de capture
    private func handleCompletionOrFailure(_ state: ObjectCaptureSession.CaptureState, session: ObjectCaptureSession) async {
        // Gérer la complétion
        if case .completed = state {
            // Récupérer le captureFolderManager depuis le thread principal
            let captureFolderManager = await MainActor.run { AppDataModel.instance.captureFolderManager }
            
            if let captureFolderManager = captureFolderManager {
                // Construire les chemins des fichiers
                let modelPath = captureFolderManager.modelsFolder.appendingPathComponent("model-mobile.usdz").path
                let previewPath = modelPath

                // Envoyer l'événement de complétion
                sendModelCompleteEvent(modelPath: modelPath, previewPath: previewPath)
            }
        }

        // Gérer les erreurs
        if case .failed(let error) = state {
            sendErrorEvent(error)
        }
    }

    /// Convertit un état en chaîne de caractères
    /// - Parameter state: L'état à convertir
    /// - Returns: Une chaîne représentant l'état
    private func getStateString(_ state: ObjectCaptureSession.CaptureState) -> String {
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
}

// MARK: - Extensions pour AppDataModelFeedbackDelegate

extension ExpoObjectCaptureEventBridge: AppDataModelFeedbackDelegate {
    /// Implémentation du protocole AppDataModelFeedbackDelegate
    /// - Parameter messages: Les messages de feedback à transmettre
    public func didUpdateFeedback(messages: [String]) {
        // Éviter les doublons
        if Set(messages) == Set(lastReportedFeedbackMessages) {
            return
        }

        lastReportedFeedbackMessages = messages

        // Envoyer l'événement sur le thread principal
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let module = self.module else { return }

            module.sendEvent("onFeedbackChanged", [
                "messages": messages
            ])
            self.logger.debug("Événement feedback (delegate) envoyé: \(messages)")
        }
    }
}

// MARK: - Extension pour la surveillance de la progression de reconstruction

extension ExpoObjectCaptureEventBridge {
    /// Configure la surveillance de la progression de la reconstruction
    /// - Parameter session: La session de photogrammétrie à surveiller
    func setupReconstructionProgressTracking(for session: PhotogrammetrySession) {
        Task { [weak self] in
            guard let self = self else { return }

            do {
                // Utiliser UntilProcessingCompleteFilter pour suivre les sorties jusqu'à la fin
                let outputs = UntilProcessingCompleteFilter(input: session.outputs)

                for await output in outputs {
                    guard !Task.isCancelled else { break }

                    switch output {
                    case .requestProgress(let request, fractionComplete: let fractionComplete):
                        if case .modelFile = request {
                            self.sendProgressEvent(progress: Float(fractionComplete))
                        }

                    case .requestProgressInfo(let request, let progressInfo):
                        if case .modelFile = request {
                            let stage = progressInfo.processingStage?.processingStageStringValue
                            self.sendProgressEvent(
                                progress: Float(1),
                                stage: stage,
                                timeRemaining: progressInfo.estimatedRemainingTime
                            )
                        }

                    case .requestError(_, let requestError):
                        self.sendErrorEvent(requestError)

                    case .processingComplete:
                        // La reconstruction est terminée, envoyée via ModelComplete dans handleCompletionOrFailure
                        break

                    default:
                        // Ignorer les autres types de sorties
                        break
                    }
                }
            }
        }
    }
}

// MARK: - Extension de PhotogrammetrySession.Output.ProcessingStage

extension PhotogrammetrySession.Output.ProcessingStage {
    /// Convertit l'étape de traitement en chaîne lisible
    var processingStageStringValue: String? {
        switch self {
        case .preProcessing:
            return "Preprocessing"
        case .imageAlignment:
            return "Aligning Images"
        case .pointCloudGeneration:
            return "Generating Point Cloud"
        case .meshGeneration:
            return "Generating Mesh"
        case .textureMapping:
            return "Mapping Texture"
        case .optimization:
            return "Optimizing"
        default:
            return nil
        }
    }
}
