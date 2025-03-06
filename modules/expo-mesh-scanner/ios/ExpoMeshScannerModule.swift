import ExpoModulesCore
import RealityKit
import SwiftUI
import Combine

// Main module class for Expo
public class ExpoMeshScannerModule: Module {
    // Object Capture session
    private var captureSession = ObjectCaptureSession()
    private var cancellables = Set<AnyCancellable>()
    private var scanState = ScanState.notStarted
    private var scanProgress: Float = 0.0
    
    // State for tracking scan progress
    enum ScanState {
        case notStarted
        case ready
        case detecting
        case capturing
        case completed
        case processing
        case finished
        case error(String)
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
                        // Create directories for scan
                        let fileManager = FileManager.default
                        let documentsDir = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
                        let imagesDir = documentsDir.appendingPathComponent("ScanImages", isDirectory: true)
                        let checkpointsDir = documentsDir.appendingPathComponent("ScanCheckpoints", isDirectory: true)
                        
                        try? fileManager.createDirectory(at: imagesDir, withIntermediateDirectories: true)
                        try? fileManager.createDirectory(at: checkpointsDir, withIntermediateDirectories: true)
                        
                        // Configure scan session
                        var configuration = ObjectCaptureSession.Configuration()
                        configuration.checkpointDirectory = checkpointsDir
                        
                        // Extract options
                        if let options = options {
                            if let overCapture = options["enableOverCapture"] as? Bool {
                                configuration.isOverCaptureEnabled = overCapture
                            }
                            
                            if let highQuality = options["highQualityMode"] as? Bool, highQuality {
                                configuration.requestedOutputDetail = .high
                            } else {
                                configuration.requestedOutputDetail = .medium
                            }
                        }
                        
                        // Setup state observation
                        self.setupSessionObservers()
                        
                        // Start the session
                        self.captureSession.start(imagesDirectory: imagesDir, configuration: configuration)
                        self.scanState = .ready
                        
                        self.sendEvent("onScanStateChanged", ["state": "ready"])
                        promise.resolve(["success": true, "imagesPath": imagesDir.path])
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
                    if self.scanState == .ready {
                        self.captureSession.startDetecting()
                        self.scanState = .detecting
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
        
        // Start capturing after object is detected
        AsyncFunction("startCapturing") { (promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.main.async {
                    if self.scanState == .detecting {
                        self.captureSession.startCapturing()
                        self.scanState = .capturing
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
        
        // Finish the scan after completing capture
        AsyncFunction("finishScan") { (promise: Promise) in
            if #available(iOS 17.0, *) {
                DispatchQueue.main.async {
                    if self.captureSession.userCompletedScanPass {
                        self.captureSession.finish()
                        self.scanState = .processing
                        self.sendEvent("onScanStateChanged", ["state": "processing"])
                        promise.resolve(["success": true])
                    } else {
                        promise.reject(Exception(name: "invalid_state", description: "Scan pass not completed"))
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
                    self.scanState = .notStarted
                    self.sendEvent("onScanStateChanged", ["state": "cancelled"])
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
                        
                        let modelURL = modelDir.appendingPathComponent("model.usdz")
                        let previewURL = modelDir.appendingPathComponent("preview.jpg")
                        
                        // Configure photogrammetry
                        var configuration = PhotogrammetrySession.Configuration()
                        configuration.checkpointDirectory = documentsDir.appendingPathComponent("ScanCheckpoints")
                        
                        // Set detail level based on options
                        if let options = options, let detailLevel = options["detailLevel"] as? String {
                            switch detailLevel {
                            case "high":
                                configuration.detail = .high
                            case "medium":
                                configuration.detail = .medium
                            case "low":
                                configuration.detail = .low
                            default:
                                configuration.detail = .medium
                            }
                        } else {
                            configuration.detail = .medium
                        }
                        
                        // Create the photogrammetry session
                        let photogrammetrySession = try PhotogrammetrySession(
                            input: imagesDir,
                            configuration: configuration
                        )
                        
                        // Begin processing
                        try photogrammetrySession.process(requests: [
                            .modelFile(url: modelURL),
                            .previewImage(url: previewURL)
                        ])
                        
                        // Track progress
                        for try await output in photogrammetrySession.outputs {
                            switch output {
                            case .processingComplete:
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
                                    self.sendEvent("onReconstructionProgress", [
                                        "progress": info.fractionComplete,
                                        "stage": info.description
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
            } else {
                promise.reject(Exception(name: "ios_version", description: "iOS 17 or later is required"))
            }
        }
        
        // Get current scan stats and state
        Function("getScanState") {
            if #available(iOS 17.0, *) {
                var stateString: String
                
                switch self.scanState {
                case .notStarted: stateString = "notStarted"
                case .ready: stateString = "ready"
                case .detecting: stateString = "detecting"
                case .capturing: stateString = "capturing"
                case .completed: stateString = "completed"
                case .processing: stateString = "processing"
                case .finished: stateString = "finished"
                case .error(let message): stateString = "error"
                }
                
                return [
                    "state": stateString,
                    "progress": self.scanProgress,
                    "isCompleted": self.captureSession.userCompletedScanPass
                ]
            } else {
                return [
                    "state": "unsupported",
                    "progress": 0,
                    "isCompleted": false
                ]
            }
        }
        
        // Define the native view component
        ViewManager {
            // Properly register the view manager with the same name as the module
            ViewManager.Name("ExpoMeshScanner")
            
            // Create the view
            ViewManager.View { context in
                ExpoMeshScannerView(appContext: context.appContext)
            }
            
            // Add session property
            ViewManager.Prop("session") { (view: ExpoMeshScannerView, value: Bool) in
                if #available(iOS 17.0, *), value {
                    view.setSession(self.captureSession)
                }
            }
        }
    }
    
    // MARK: - Private methods
    
    @available(iOS 17.0, *)
    private func setupSessionObservers() {
        // Clear previous observers
        cancellables.removeAll()
        
        // Observe session state changes
        captureSession.publisher(for: \.state)
            .sink { [weak self] state in
                guard let self = self else { return }
                
                var stateString: String
                
                switch state {
                case .initializing:
                    stateString = "initializing"
                case .ready:
                    self.scanState = .ready
                    stateString = "ready"
                case .detecting:
                    self.scanState = .detecting
                    stateString = "detecting"
                case .capturing:
                    self.scanState = .capturing
                    stateString = "capturing"
                case .completed:
                    self.scanState = .completed
                    stateString = "completed"
                case .finishing:
                    stateString = "finishing"
                case .failed(let error):
                    self.scanState = .error(error.localizedDescription)
                    stateString = "error"
                    self.sendEvent("onScanError", ["message": error.localizedDescription])
                default:
                    stateString = "unknown"
                }
                
                self.sendEvent("onScanStateChanged", ["state": stateString])
            }
            .store(in: &cancellables)
        
        // Observe feedback
        captureSession.publisher(for: \.feedback)
            .sink { [weak self] feedback in
                guard let self = self else { return }
                
                if let feedback = feedback {
                    self.sendEvent("onScanProgressUpdate", ["feedback": feedback.description])
                }
            }
            .store(in: &cancellables)
        
        // Observe completion
        captureSession.publisher(for: \.userCompletedScanPass)
            .sink { [weak self] completed in
                guard let self = self else { return }
                
                if completed {
                    self.scanState = .completed
                    self.sendEvent("onScanStateChanged", ["state": "completed"])
                    self.sendEvent("onScanComplete", [:])
                }
            }
            .store(in: &cancellables)
    }
}
