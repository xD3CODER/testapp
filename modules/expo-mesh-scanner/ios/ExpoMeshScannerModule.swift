import ExpoModulesCore
import RealityKit
import SwiftUI
import Combine

// Main module class for Expo
@MainActor
public class ExpoMeshScannerModule: Module {
    // Object Capture session
    private var captureSession = ObjectCaptureSession()
    private var cancellables = Set<AnyCancellable>()
    private var internalScanState = InternalScanState.notStarted
    private var scanProgress: Float = 0.0
    private var timer: Timer?
    private var capturedImageCount: Int = 0
    
    // State for tracking scan progress
    enum InternalScanState: String {
        case notStarted
        case ready
        case detecting
        case capturing
        case completed
        case processing
        case finished
        case error
    }
    
    // Define the module's interface
    public func definition() -> ModuleDefinition {
        Name("ExpoMeshScanner")
        
        Events(
            "onScanStateChanged",
            "onScanProgressUpdate",
            "onScanComplete",
            "onScanError",
            "onReconstructionProgress",
            "onReconstructionComplete"
        )
        
        View(ExpoMeshScannerView.self) {
            Prop("session") { (view: ExpoMeshScannerView, value: Bool) in
                if #available(iOS 17.0, *), value {
                    view.setSession(self.captureSession)
                }
            }
        }
        
        // Clean scan directories to prevent "directoryNotEmpty" errors
        Function("cleanScanDirectories") {
            do {
                let fileManager = FileManager.default
                let documentsDir = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
                let imagesDir = documentsDir.appendingPathComponent("ScanImages", isDirectory: true)
                let checkpointsDir = documentsDir.appendingPathComponent("ScanCheckpoints", isDirectory: true)
                let modelDir = documentsDir.appendingPathComponent("Models", isDirectory: true)
                
                // Remove directories if they exist
                if fileManager.fileExists(atPath: imagesDir.path) {
                    try fileManager.removeItem(at: imagesDir)
                }
                if fileManager.fileExists(atPath: checkpointsDir.path) {
                    try fileManager.removeItem(at: checkpointsDir)
                }
                
                // Create the Models directory if it doesn't exist
                if !fileManager.fileExists(atPath: modelDir.path) {
                    try fileManager.createDirectory(at: modelDir, withIntermediateDirectories: true, attributes: nil)
                }
                
                return true
            } catch {
                print("Error cleaning scan directories: \(error)")
                return false
            }
        }
        
        // Reset module to clear any error state
        Function("resetModule") {
            if #available(iOS 17.0, *) {
                // Cancel any existing session
                self.captureSession.cancel()
                
                // Create a fresh session
                self.captureSession = ObjectCaptureSession()
                
                // Reset internal state
                self.updateInternalState(.notStarted)
                
                // Reset other properties
                self.scanProgress = 0.0
                self.capturedImageCount = 0
                self.timer?.invalidate()
                self.timer = nil
                self.cancellables.removeAll()
                
                return true
            }
            return false
        }
        
        // Check device support for Object Capture
        AsyncFunction("checkSupport") { (promise: Promise) in
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
        
        // Configure and start a new scan
        AsyncFunction("startScan") { (options: [String: Any]?, promise: Promise) in
            if #available(iOS 17.0, *) {
                guard ObjectCaptureSession.isSupported else {
                    promise.reject(Exception(name: "device_not_supported", description: "This device doesn't support Object Capture"))
                    return
                }
                
                DispatchQueue.main.async {
                    do {
                        // Clean up existing directories first to prevent errors
                        try self.cleanDirectories()
                        
                        // Create directories for scan
                        let fileManager = FileManager.default
                        let documentsDir = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
                        let imagesDir = documentsDir.appendingPathComponent("ScanImages", isDirectory: true)
                        let checkpointsDir = documentsDir.appendingPathComponent("ScanCheckpoints", isDirectory: true)
                        
                        try fileManager.createDirectory(at: imagesDir, withIntermediateDirectories: true, attributes: nil)
                        try fileManager.createDirectory(at: checkpointsDir, withIntermediateDirectories: true, attributes: nil)
                        
                        // Configure scan session
                        var configuration = ObjectCaptureSession.Configuration()
                        configuration.checkpointDirectory = checkpointsDir
                        
                        // Extract options
                        if let options = options {
                            if let overCapture = options["enableOverCapture"] as? Bool {
                                configuration.isOverCaptureEnabled = overCapture
                            }
                        }
                        
                        // Setup state observation
                        self.setupSessionObservers()
                        
                        // Start the session
                        self.captureSession.start(imagesDirectory: imagesDir, configuration: configuration)
                        self.updateInternalState(.ready)
                        
                        self.sendEvent("onScanStateChanged", ["state": "ready"])
                        promise.resolve([
                            "success": true,
                            "imagesPath": imagesDir.path
                        ])
                    } catch {
                        promise.reject(Exception(name: "start_scan_error", description: error.localizedDescription))
                    }
                }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }
        
        // Transition to detection state
        AsyncFunction("startDetecting") { (promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.main.async {
                    // Use explicit enum type to avoid ambiguity
                    print(self.internalScanState)
                    if self.internalScanState == ExpoMeshScannerModule.InternalScanState.ready {
                        self.captureSession.startDetecting()
                        self.updateInternalState(.detecting)
                        promise.resolve(["success": true])
                    } else {
                        promise.reject(Exception(name: "invalid_state", description: "Session is not in ready state"))
                    }
                }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }
        
        // Start capturing after object is detected
        AsyncFunction("startCapturing") { (promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.main.async {
                    // Use explicit enum type to avoid ambiguity
                    if self.internalScanState == ExpoMeshScannerModule.InternalScanState.detecting {
                        self.captureSession.startCapturing()
                        self.updateInternalState(.capturing)
                        promise.resolve(["success": true])
                    } else {
                        promise.reject(Exception(name: "invalid_state", description: "Session is not in detecting state"))
                    }
                }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }
        
        // Finish the scan after completing capture
        AsyncFunction("finishScan") { (promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.main.async {
                    // This is critical - with Object Capture, we need to call finish()
                    // to indicate that the user has completed capturing images
                    if self.internalScanState == .capturing {
                        // Mark scan as complete - this tells the system we're done capturing
                        self.captureSession.finish()
                        self.updateInternalState(.processing)
                        promise.resolve(["success": true])
                    } else if self.captureSession.userCompletedScanPass {
                        // If somehow the user already completed the scan
                        self.updateInternalState(.processing)
                        promise.resolve(["success": true])
                    } else {
                        promise.reject(Exception(name: "invalid_state", description: "Session is not in capturing state or scan pass not completed"))
                    }
                }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }
        
        // Cancel current scan
        AsyncFunction("cancelScan") { (promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.main.async {
                    self.captureSession.cancel()
                    self.updateInternalState(.notStarted)
                    promise.resolve(["success": true])
                }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }
        
        // Generate 3D model from captured images
        AsyncFunction("reconstructModel") { (options: [String: Any]?, promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.global(qos: .userInitiated).async {
                    do {
                        let fileManager = FileManager.default
                        let documentsDir = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
                        let imagesDir = documentsDir.appendingPathComponent("ScanImages")
                        let modelDir = documentsDir.appendingPathComponent("Models")
                        
                        try? fileManager.createDirectory(at: modelDir, withIntermediateDirectories: true)
                        
                        let modelURL = modelDir.appendingPathComponent("model_\(Int(Date().timeIntervalSince1970)).usdz")
                        let previewURL = modelDir.appendingPathComponent("preview_\(Int(Date().timeIntervalSince1970)).jpg")
                        
                        // Configure photogrammetry
                        var configuration = PhotogrammetrySession.Configuration()
                        configuration.featureSensitivity = .high
                        // Adjacent images are next to each other.
                        configuration.sampleOrdering = .sequential
                        // Object masking is enabled.
                        configuration.isObjectMaskingEnabled = true
                        configuration.checkpointDirectory = documentsDir.appendingPathComponent("ScanCheckpoints")
                       
                        // Create the photogrammetry session
                        let photogrammetrySession = try PhotogrammetrySession(
                            input: imagesDir,
                            configuration: configuration
                        )
                        
                        // Begin processing
                        Task {
                            do {
                                // Begin processing with only model file request
                                // The previewImage request isn't available in your API version
                                try photogrammetrySession.process(requests: [
                                    .modelFile(url: modelURL)
                                    // .previewImage(url: previewURL) - removed as it's not available
                                ])
                                
                                // Track progress
                                for try await output in photogrammetrySession.outputs {
                                    switch output {
                                    case .processingComplete:
                                        // Generate a simple preview image as a fallback
                                        Task {
                                            await self.generatePreviewImage(from: imagesDir, to: previewURL)
                                        }
                                        
                                        DispatchQueue.main.async {
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
                                        
                                    case .inputComplete:
                                        DispatchQueue.main.async {
                                            self.sendEvent("onReconstructionProgress", [
                                                "progress": 0.1,
                                                "stage": "Input processing complete"
                                            ])
                                        }
                                        
                                    case .requestProgress(let request, let fraction):
                                        DispatchQueue.main.async {
                                            self.sendEvent("onReconstructionProgress", [
                                                "progress": fraction,
                                                "stage": "Processing \(fraction * 100)%"
                                            ])
                                        }
                                        
                                    case .requestProgressInfo(let request, let info):
                                        DispatchQueue.main.async {
                                            // Utiliser une valeur de progression incrémentale
                                            // puisque nous ne pouvons pas accéder aux propriétés spécifiques de l'info
                                            self.scanProgress += 0.05
                                            if self.scanProgress > 1.0 {
                                                self.scanProgress = 0.1
                                            }
                                            
                                            self.sendEvent("onReconstructionProgress", [
                                                "progress": self.scanProgress,
                                                "stage": "Processing model..."
                                            ])
                                        }
                                        
                                    case .requestError(let request, let error):
                                        DispatchQueue.main.async {
                                            self.sendEvent("onScanError", [
                                                "message": error.localizedDescription
                                            ])
                                            
                                            promise.reject(Exception(name: "reconstruction_error", description: error.localizedDescription))
                                        }
                                        
                                    default:
                                        break
                                    }
                                }
                            } catch {
                                DispatchQueue.main.async {
                                    self.sendEvent("onScanError", ["message": error.localizedDescription])
                                    promise.reject(Exception(name: "reconstruction_error", description: error.localizedDescription))
                                }
                            }
                        }
                    } catch {
                        DispatchQueue.main.async {
                            self.sendEvent("onScanError", ["message": error.localizedDescription])
                            promise.reject(Exception(name: "reconstruction_error", description: error.localizedDescription))
                        }
                    }
                }
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }
        
        // Get current scan stats and state
        Function("getScanState") {
            if #available(iOS 17.0, *) {
                return [
                    "state": self.internalScanState.rawValue,
                    "progress": self.scanProgress,
                    "isCompleted": self.captureSession.userCompletedScanPass,
                    "imageCount": self.capturedImageCount
                ]
            } else {
                return [
                    "state": "unsupported",
                    "progress": 0,
                    "isCompleted": false,
                    "imageCount": 0
                ]
            }
        }

        // Get detailed feedback from the capture session
        Function("getCaptureFeedback") {
            if #available(iOS 17.0, *) {
                let feedbacks = self.captureSession.feedback
                let feedbackMessages = feedbacks.map { String(describing: $0) }
                
                return [
                    "feedbackCount": feedbacks.count,
                    "feedbackMessages": feedbackMessages,
                    "capturedImageCount": self.capturedImageCount
                ]
            } else {
                return [
                    "feedbackCount": 0,
                    "feedbackMessages": [],
                    "capturedImageCount": 0
                ]
            }
        }
    }
    
    // MARK: - Private methods
    
    private func updateInternalState(_ newState: InternalScanState) {
        if internalScanState != newState {
            internalScanState = newState
            sendEvent("onScanStateChanged", ["state": newState.rawValue])
        }
    }
    
    private func cleanDirectories() throws {
        let fileManager = FileManager.default
        let documentsDir = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        let imagesDir = documentsDir.appendingPathComponent("ScanImages", isDirectory: true)
        let checkpointsDir = documentsDir.appendingPathComponent("ScanCheckpoints", isDirectory: true)
        
        // Remove directories if they exist
        if fileManager.fileExists(atPath: imagesDir.path) {
            try fileManager.removeItem(at: imagesDir)
        }
        if fileManager.fileExists(atPath: checkpointsDir.path) {
            try fileManager.removeItem(at: checkpointsDir)
        }
    }
    
    @available(iOS 17.0, *)
    private func generatePreviewImage(from sourceDir: URL, to destinationURL: URL) async {
        // Simple fallback to copy the first image as preview if API doesn't support preview generation
        let fileManager = FileManager.default
        
        do {
            let contents = try fileManager.contentsOfDirectory(at: sourceDir, includingPropertiesForKeys: nil)
            let imageFiles = contents.filter { $0.pathExtension.lowercased() == "jpg" || $0.pathExtension.lowercased() == "jpeg" }
            
            if let firstImage = imageFiles.first {
                try fileManager.copyItem(at: firstImage, to: destinationURL)
            }
        } catch {
            print("Error generating preview image: \(error)")
        }
    }
    
    // Track captured image count manually
    // This handles the case where the API doesn't provide direct access to capturedImageCount
    private func countCapturedImages() -> Int {
        do {
            let fileManager = FileManager.default
            let documentsDir = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
            let imagesDir = documentsDir.appendingPathComponent("ScanImages")
            
            if fileManager.fileExists(atPath: imagesDir.path) {
                let contents = try fileManager.contentsOfDirectory(at: imagesDir, includingPropertiesForKeys: nil)
                let imageFiles = contents.filter { $0.pathExtension.lowercased() == "jpg" || $0.pathExtension.lowercased() == "jpeg" }
                return imageFiles.count
            }
        } catch {
            print("Error counting images: \(error)")
        }
        return 0
    }
    
    @available(iOS 17.0, *)
    private func setupSessionObservers() {
        // Clean up existing timer if any
        timer?.invalidate()
        cancellables.removeAll()
        
        // Start a polling timer
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            
            // Check session state
            let sessionState = self.captureSession.state
            
            // Update captured image count (track manually since the API may not provide this)
            self.capturedImageCount = self.countCapturedImages()
            
            // Handle feedback
            let feedbacks = self.captureSession.feedback
            if !feedbacks.isEmpty, let firstFeedback = feedbacks.first {
                self.sendEvent("onScanProgressUpdate", [
                    "feedback": String(describing: firstFeedback),
                    "imageCount": self.capturedImageCount
                ])
            }
            
            // Check completion status
            if self.captureSession.userCompletedScanPass &&
               self.internalScanState != ExpoMeshScannerModule.InternalScanState.completed {
                self.updateInternalState(.completed)
                self.sendEvent("onScanComplete", [
                    "imageCount": self.capturedImageCount
                ])
            }
            
            // Check for errors
            if case .failed(let error) = sessionState {
                print("ObjectCaptureSession failed with error: \(error.localizedDescription)")
                self.updateInternalState(.error)
                self.sendEvent("onScanError", ["message": error.localizedDescription])
            }
        }
        
        // Keep the timer in cancellables
        if let timer = timer {
            timer.tolerance = 0.1
            cancellables.insert(AnyCancellable {
                timer.invalidate()
            })
        }
    }
    
    deinit {
        timer?.invalidate()
    }
}
