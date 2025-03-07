// Classe de données partagées pour maintenir l'état entre les différents composants
class ScanProcessManager {
    static let shared = ScanProcessManager()
    
    // État actuel
    var currentState: ScanState = .notStarted
    var captureMode: CaptureMode = .object
    var objectDimensions = ObjectDimensions()
    var objectPosition: ObjectPosition?
    var error: Error?
    
    // Chemin de fichiers
    var imagesFolder: URL?
    var modelsFolder: URL?
    var checkpointFolder: URL?
    
    private init() {}
    
    func createCaptureDirectories() throws -> (images: URL, checkpoints: URL, models: URL) {
        // Création des répertoires pour le scan
        let fileManager = FileManager.default
        let documentsDir = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let captureDir = documentsDir.appendingPathComponent(timestamp)
        
        let imagesDir = captureDir.appendingPathComponent("Images")
        let checkpointsDir = captureDir.appendingPathComponent("Checkpoints")
        let modelsDir = captureDir.appendingPathComponent("Models")
        
        try fileManager.createDirectory(at: imagesDir, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: checkpointsDir, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: modelsDir, withIntermediateDirectories: true)
        
        self.imagesFolder = imagesDir
        self.checkpointFolder = checkpointsDir
        self.modelsFolder = modelsDir
        
        return (imagesDir, checkpointsDir, modelsDir)
    }
}
