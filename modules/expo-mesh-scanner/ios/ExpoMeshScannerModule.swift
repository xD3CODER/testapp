import ExpoModulesCore
import ARKit
import Metal
import AVFoundation
import UIKit

// MARK: - Types de données pour la capture
struct CaptureImage {
  var image: UIImage
  var pose: simd_float4x4
  var timestamp: TimeInterval
}

public class ExpoMeshScannerModule: Module {
  // Propriétés du module
  internal var session: ARSession?
  internal var configuration: ARWorldTrackingConfiguration?
  private var isScanning = false
  private var meshVertices = [NSNumber]()
  private var meshFaces = [NSNumber]()
  internal var scanRadius: Float = 1.0
  private var lastUpdateTime: TimeInterval = 0

  // Propriétés pour la photogrammétrie
  private var captureMode: CaptureMode = .auto
  private var capturedImages: [CaptureImage] = []
  private var captureTimer: Timer?
  private var lastImageCaptureTime: TimeInterval = 0
  private var targetObject: CGRect?
  private var initialPose: simd_float4x4?
  private var currentAngle: Float = 0

  // Énumération pour le mode de capture
  enum CaptureMode: String {
    case manual = "manual"       // L'utilisateur décide quand capturer
    case auto = "auto"           // Capture automatique basée sur le mouvement
    case guided = "guided"       // Guide l'utilisateur à travers des positions
  }

  // Options de scan
  struct ScanOptions {
    var radius: Float = 1.0
    var captureMode: CaptureMode = .auto
    var captureIntervalSeconds: TimeInterval = 1.0
    var targetAngleIncrement: Float = 15.0  // degrés entre chaque capture guidée
    var maxImages: Int = 36                 // nombre maximal d'images à capturer
    var targetObject: CGRect?               // zone de l'écran où se trouve l'objet
  }

  // Définir le nom du module
  public func definition() -> ModuleDefinition {
    Name("ExpoMeshScanner")

    // Déclarer les événements que le module peut émettre
    Events(
      "onMeshUpdated",
      "onScanComplete",
      "onScanError",
      "onImageCaptured",
      "onGuidanceUpdate"
    )

    // Définition correcte de la vue
    View(ExpoMeshScannerView.self) {
        Prop("initialize") { (view: ExpoMeshScannerView, value: Bool) in
            if value {
                view.initialize()
            }
        }

        Prop("isScanning") { (view: ExpoMeshScannerView, value: Bool) in
            // Mettre à jour les données partagées
            SharedScannerData.shared.isScanning = value

            if value {
                view.startScanning()
            } else {
                view.stopScanning()
            }
        }

        Prop("showMesh") { (view: ExpoMeshScannerView, value: Bool) in
            view.updateMeshVisualization(showMesh: value)
        }

        Prop("showGuides") { (view: ExpoMeshScannerView, value: Bool) in
            view.updateGuideVisualization(showGuides: value)
        }

        Prop("showCapturedImages") { (view: ExpoMeshScannerView, value: Bool) in
            view.showCapturedImageLocations(show: value)
        }

        Prop("targetObject") { (view: ExpoMeshScannerView, value: [String: Any]) in
            if let x = value["x"] as? Double,
               let y = value["y"] as? Double,
               let width = value["width"] as? Double,
               let height = value["height"] as? Double {
                let rect = CGRect(x: x, y: y, width: width, height: height)
                self.targetObject = rect
                SharedScannerData.shared.targetObject = rect
                view.setTargetObject(rect: rect)
            }
        }

        // Exposer les événements
        Events("onInitialized", "onTouch", "onTrackingStateChanged")
    }

    // Méthode pour vérifier si l'appareil supporte le mesh scanning
    AsyncFunction("checkSupport") { (promise: Promise) in
      if #available(iOS 13.4, *) {
        // Vérifier le support LiDAR/mesh scanning
        let isLiDARSupported = ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)

        // Vérifier la caméra (pour photogrammétrie)
        let isCameraSupported = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) != nil

        promise.resolve([
          "supported": isLiDARSupported || isCameraSupported,
          "hasLiDAR": isLiDARSupported,
          "hasCamera": isCameraSupported,
          "reason": isLiDARSupported ? "" : (isCameraSupported ? "LiDAR non disponible, photogrammétrie uniquement" : "Appareil non compatible")
        ])
      } else {
        promise.resolve([
          "supported": false,
          "hasLiDAR": false,
          "hasCamera": false,
          "reason": "iOS version does not support scene reconstruction or advanced AR"
        ])
      }
    }

    // Méthode pour sélectionner l'objet cible
    AsyncFunction("selectObject") { (x: Double, y: Double, width: Double, height: Double, promise: Promise) in
      let rect = CGRect(x: x, y: y, width: width, height: height)
      self.targetObject = rect
      SharedScannerData.shared.targetObject = rect

      promise.resolve(["success": true, "rect": [
        "x": x,
        "y": y,
        "width": width,
        "height": height
      ]])
    }

    // Méthode pour démarrer le scan
    AsyncFunction("startScan") { (options: [String: Any]?, promise: Promise) in
      if self.isScanning {
        promise.reject(Exception(name: "already_scanning", description: "A scan is already in progress"))
        return
      }

      DispatchQueue.main.async {
        // Extraire les options
        let scanOptions = self.parseScanOptions(options)

        // Réinitialiser les données de scan
        self.meshVertices.removeAll()
        self.meshFaces.removeAll()
        self.capturedImages.removeAll()
        self.lastImageCaptureTime = 0
        self.currentAngle = 0
        self.initialPose = nil

        // Configurer ARKit
        if #available(iOS 13.4, *) {
          self.session = ARSession()
          self.session?.delegate = ARScanDelegate(module: self)
          self.configuration = ARWorldTrackingConfiguration()

          // Activer le LiDAR si disponible
          if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            self.configuration?.sceneReconstruction = .mesh
            self.configuration?.environmentTexturing = .automatic
            self.configuration?.planeDetection = [.horizontal, .vertical]

            if #available(iOS 13.0, *) {
              self.configuration?.frameSemantics = [.sceneDepth, .smoothedSceneDepth]
            }
          }

          // Démarrer la session AR
          self.session?.run(self.configuration!)
          self.isScanning = true
          SharedScannerData.shared.isScanning = true

          // Configurer la capture automatique si nécessaire
          self.configureAutomaticCapture(mode: scanOptions.captureMode, interval: scanOptions.captureIntervalSeconds)

          promise.resolve(["success": true])
        } else {
          promise.reject(Exception(name: "ios_version", description: "iOS version does not support scene reconstruction"))
        }
      }
    }

    // Méthode pour capturer manuellement une image
    AsyncFunction("captureImage") { (promise: Promise) in
      if !self.isScanning {
        promise.reject(Exception(name: "not_scanning", description: "No scan is in progress"))
        return
      }

      DispatchQueue.main.async {
        if #available(iOS 13.0, *), let currentFrame = self.session?.currentFrame {
          self.captureImageFromFrame(currentFrame)
          promise.resolve(["success": true, "imageCount": self.capturedImages.count])
        } else {
          promise.reject(Exception(name: "capture_failed", description: "Failed to capture image"))
        }
      }
    }

    // Méthode pour arrêter le scan
    AsyncFunction("stopScan") { (promise: Promise) in
      if !self.isScanning {
        promise.reject(Exception(name: "not_scanning", description: "No scan is in progress"))
        return
      }

      DispatchQueue.main.async {
        // Arrêter la capture automatique
        self.captureTimer?.invalidate()
        self.captureTimer = nil

        if #available(iOS 13.4, *) {
          // Extraire le mesh final
          if let delegate = self.session?.delegate as? ARScanDelegate {
            delegate.extractMeshData()
          }

          // Arrêter la session
          self.session?.pause()
          self.isScanning = false
          SharedScannerData.shared.isScanning = false

          // Convertir les images capturées
          var imageData: [[String: Any]] = []
          for (index, capturedImage) in self.capturedImages.enumerated() {
            // Sauvegarder l'image dans un fichier temporaire
            let imagePath = self.saveImageToTempFile(capturedImage.image, index: index)

            if let imagePath = imagePath {
              imageData.append([
                "uri": imagePath,
                "timestamp": capturedImage.timestamp,
                "transform": self.transformToArray(capturedImage.pose)
              ])
            }
          }

          // Préparer les données de retour
          let scanResultData: [String: Any] = [
            "mesh": [
              "vertices": self.meshVertices,
              "faces": self.meshFaces,
              "count": self.meshVertices.count / 3
            ],
            "images": imageData,
            "targetObject": self.targetObject != nil ? [
              "x": self.targetObject!.origin.x,
              "y": self.targetObject!.origin.y,
              "width": self.targetObject!.size.width,
              "height": self.targetObject!.size.height
            ] : NSNull()
          ]

          // Envoyer les données complètes
          self.sendEvent("onScanComplete", scanResultData)
          promise.resolve(scanResultData)
        } else {
          promise.reject(Exception(name: "ios_version", description: "iOS version does not support scene reconstruction"))
        }
      }
    }
  }

  // MARK: - Méthodes auxiliaires

  // Parser les options de scan
  private func parseScanOptions(_ options: [String: Any]?) -> ScanOptions {
    var scanOptions = ScanOptions()

    if let options = options {
      if let radius = options["radius"] as? NSNumber {
        scanOptions.radius = radius.floatValue
      }

      if let captureModeName = options["captureMode"] as? String,
         let captureMode = CaptureMode(rawValue: captureModeName) {
        scanOptions.captureMode = captureMode
      }

      if let captureInterval = options["captureInterval"] as? NSNumber {
        scanOptions.captureIntervalSeconds = captureInterval.doubleValue
      }

      if let angleIncrement = options["angleIncrement"] as? NSNumber {
        scanOptions.targetAngleIncrement = angleIncrement.floatValue
      }

      if let maxImages = options["maxImages"] as? NSNumber {
        scanOptions.maxImages = maxImages.intValue
      }

      if let targetObjectDict = options["targetObject"] as? [String: NSNumber],
         let x = targetObjectDict["x"]?.doubleValue,
         let y = targetObjectDict["y"]?.doubleValue,
         let width = targetObjectDict["width"]?.doubleValue,
         let height = targetObjectDict["height"]?.doubleValue {
        scanOptions.targetObject = CGRect(x: x, y: y, width: width, height: height)
      }
    }

    return scanOptions
  }

  // Configurer la capture automatique
  private func configureAutomaticCapture(mode: CaptureMode, interval: TimeInterval) {
    self.captureMode = mode

    // Si en mode auto, configurer un timer
    if mode == .auto {
      self.captureTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
        guard let self = self, let currentFrame = self.session?.currentFrame else { return }
        self.captureImageFromFrame(currentFrame)
      }
    }
  }

    // Dans ExpoMeshScannerModule.swift, remplacez la méthode captureImageFromFrame par:

    @available(iOS 13.0, *)
    private func captureImageFromFrame(_ frame: ARFrame) {
      // Utiliser un thread de fond pour le traitement d'image
      DispatchQueue.global(qos: .userInitiated).async { [weak self] in
        guard let self = self else { return }
        
        let currentTimestamp = Date().timeIntervalSince1970
        
        // Vérifier si assez de temps s'est écoulé depuis la dernière capture
        if currentTimestamp - self.lastImageCaptureTime < 0.5 {
          return
        }
        
        print("Capturing image from frame")
        
        // Obtenir l'image de la caméra
        let pixelBuffer = frame.capturedImage
        
        // Convertir de manière sécurisée
        var uiImage: UIImage?
        
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let context = CIContext(options: nil)
        
        if let cgImage = context.createCGImage(ciImage, from: ciImage.extent) {
          uiImage = UIImage(cgImage: cgImage)
        }
        
        guard let capturedImage = uiImage else {
          print("Failed to convert pixel buffer to image")
          return
        }
        
        // Si c'est la première image, enregistrer la pose initiale
        if self.initialPose == nil {
          self.initialPose = frame.camera.transform
          print("Initial pose recorded")
        }
        
        // Calculer l'angle relatif par rapport à la pose initiale (estimation simple)
        var angle: Float = 0
        if let initialPose = self.initialPose {
          // Extraire les composantes de rotation pour estimer l'angle
          let initialAngle = atan2(initialPose.columns.0.z, initialPose.columns.0.x)
          let currentAngle = atan2(frame.camera.transform.columns.0.z, frame.camera.transform.columns.0.x)
          angle = (currentAngle - initialAngle) * (180 / Float.pi)
          
          // Normaliser entre 0 et 360
          angle = angle.truncatingRemainder(dividingBy: 360)
          if angle < 0 { angle += 360 }
          
          // Mettre à jour l'angle courant
          self.currentAngle = angle
        }
        
        // Enregistrer l'image avec sa pose
        let captureImage = CaptureImage(
          image: capturedImage,
          pose: frame.camera.transform,
          timestamp: currentTimestamp
        )
        
        // Mettre à jour les données sur le thread principal
        DispatchQueue.main.async {
          self.capturedImages.append(captureImage)
          self.lastImageCaptureTime = currentTimestamp
          
          print("Image captured: total count = \(self.capturedImages.count), angle = \(angle)")
          
          // Envoyer les mises à jour
          self.sendEvent("onImageCaptured", [
            "count": self.capturedImages.count,
            "angle": angle
          ])
          
          // Envoyer les infos de guidage
          if self.captureMode == .guided {
            self.sendEvent("onGuidanceUpdate", [
              "currentAngle": angle,
              "imagesRemaining": max(0, 36 - self.capturedImages.count),
              "progress": min(1.0, Double(self.capturedImages.count) / 36.0)
            ])
          }
        }
      }
    }
    
  // Convertir un pixelBuffer en UIImage
  private func convertPixelBufferToUIImage(_ pixelBuffer: CVPixelBuffer) -> UIImage? {
    let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
    let context = CIContext(options: nil)

    guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
      return nil
    }

    return UIImage(cgImage: cgImage)
  }

  // Sauvegarder une image dans un fichier temporaire
  private func saveImageToTempFile(_ image: UIImage, index: Int) -> String? {
    let documentsDirectory = FileManager.default.temporaryDirectory
    let fileName = "scan_image_\(index).jpg"
    let fileURL = documentsDirectory.appendingPathComponent(fileName)

    guard let data = image.jpegData(compressionQuality: 0.8) else {
      return nil
    }

    do {
      try data.write(to: fileURL)
      return fileURL.path
    } catch {
      print("Error saving image: \(error)")
      return nil
    }
  }

  // Convertir une matrice de transformation en tableau
  private func transformToArray(_ transform: simd_float4x4) -> [Float] {
    var array: [Float] = []
    array.append(contentsOf: [transform.columns.0.x, transform.columns.0.y, transform.columns.0.z, transform.columns.0.w])
    array.append(contentsOf: [transform.columns.1.x, transform.columns.1.y, transform.columns.1.z, transform.columns.1.w])
    array.append(contentsOf: [transform.columns.2.x, transform.columns.2.y, transform.columns.2.z, transform.columns.2.w])
    array.append(contentsOf: [transform.columns.3.x, transform.columns.3.y, transform.columns.3.z, transform.columns.3.w])
    return array
  }

  // Méthode pour extraire les données de mesh (accessible par le délégué)
  @available(iOS 13.4, *)
  func updateMeshData(vertices: [NSNumber], faces: [NSNumber]) {
    self.meshVertices = vertices
    self.meshFaces = faces

    // Envoyer une mise à jour de progression
    let updateData: [String: Any] = [
      "vertices": meshVertices.count / 3,
      "faces": meshFaces.count / 3,
      "images": capturedImages.count,
      "currentAngle": currentAngle
    ]

    sendEvent("onMeshUpdated", updateData)
  }
}

// Dans ExpoMeshScannerModule.swift, remplacez la classe ARScanDelegate par:

@available(iOS 13.4, *)
class ARScanDelegate: NSObject, ARSessionDelegate {
  weak var module: ExpoMeshScannerModule?
  private var lastUpdateTime: TimeInterval = 0
  private let processingQueue = DispatchQueue(label: "meshScannerProcessing", qos: .userInitiated)
  
  init(module: ExpoMeshScannerModule) {
    self.module = module
    super.init()
    print("ARScanDelegate initialized")
  }
  
  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    // Limiter la fréquence des mises à jour (toutes les 500ms)
    let currentTime = Date().timeIntervalSince1970
    if currentTime - lastUpdateTime < 0.5 { return }
    lastUpdateTime = currentTime
    
    // Traiter sur un thread secondaire pour éviter de bloquer l'UI
    processingQueue.async { [weak self] in
      self?.extractMeshData()
    }
  }
  
  // Extraction des données de mesh
  func extractMeshData() {
    print("Extracting mesh data...")
    var meshVertices = [NSNumber]()
    var meshFaces = [NSNumber]()
    
    // Vérifier que le module et la session existent
    guard let module = module, let frame = module.session?.currentFrame else {
      print("No module or frame available")
      return
    }
    
    var meshAnchorsCount = 0
    
    for anchor in frame.anchors {
      guard let meshAnchor = anchor as? ARMeshAnchor else { continue }
      meshAnchorsCount += 1
      
      let vertices = meshAnchor.geometry.vertices
      let faces = meshAnchor.geometry.faces
      
      // Log des informations sur le mesh
      print("Processing mesh anchor: \(meshAnchor.identifier) - vertices: \(vertices.count), faces: \(faces.count)")
      
      // Accéder aux données des vertices
      let vertexBuffer = vertices.buffer
      let vertexCount = vertices.count
      let stride = vertices.stride / MemoryLayout<Float>.size
      
      // Extraire les données des vertices en toute sécurité
      let vertexRawPointer = vertexBuffer.contents()
      
      // Transformer et extraire les vertices
      for vertexIndex in 0..<vertexCount {
        // Calculer l'index dans le buffer
        let baseIndex = vertexIndex * stride
        
        // Accéder de manière sécurisée aux données
        let xOffset = baseIndex * MemoryLayout<Float>.size
        let yOffset = (baseIndex + 1) * MemoryLayout<Float>.size
        let zOffset = (baseIndex + 2) * MemoryLayout<Float>.size
        
        let xPtr = vertexRawPointer.advanced(by: xOffset).assumingMemoryBound(to: Float.self)
        let yPtr = vertexRawPointer.advanced(by: yOffset).assumingMemoryBound(to: Float.self)
        let zPtr = vertexRawPointer.advanced(by: zOffset).assumingMemoryBound(to: Float.self)
        
        let x = xPtr.pointee
        let y = yPtr.pointee
        let z = zPtr.pointee
        
        // Vérifier que les coordonnées sont valides
        if !x.isFinite || !y.isFinite || !z.isFinite {
          continue
        }
        
        // Créer un vecteur 3D
        let vertex = simd_float3(x, y, z)
        
        // Appliquer la transformation
        let transformedVertex = meshAnchor.transform * simd_float4(vertex, 1.0)
        
        // Vérifier si le point est dans le rayon de scan (augmenté à 5.0 pour capturer plus de points)
        let distance = sqrt(pow(transformedVertex.x, 2) + pow(transformedVertex.z, 2))
        if distance <= module.scanRadius * 5.0 {
          meshVertices.append(NSNumber(value: transformedVertex.x))
          meshVertices.append(NSNumber(value: transformedVertex.y))
          meshVertices.append(NSNumber(value: transformedVertex.z))
        }
      }
      
      // Accéder aux indices des faces
      let indexBuffer = faces.buffer
      let indexCount = faces.count
      let indicesPerFace = faces.indexCountPerPrimitive
      
      // Extraire les indices selon le format (16-bit ou 32-bit)
      if faces.bytesPerIndex == MemoryLayout<UInt16>.size {
        // Indices 16-bit
        let indexRawPointer = indexBuffer.contents()
        
        // Pour chaque triangle
        for faceIndex in 0..<indexCount {
          for i in 0..<indicesPerFace {
            let idx = faceIndex * indicesPerFace + i
            let byteOffset = idx * MemoryLayout<UInt16>.size
            
            // Accéder de manière sécurisée à l'index
            let indexPtr = indexRawPointer.advanced(by: byteOffset).assumingMemoryBound(to: UInt16.self)
            meshFaces.append(NSNumber(value: indexPtr.pointee))
          }
        }
      } else if faces.bytesPerIndex == MemoryLayout<UInt32>.size {
        // Indices 32-bit
        let indexRawPointer = indexBuffer.contents()
        
        // Pour chaque triangle
        for faceIndex in 0..<indexCount {
          for i in 0..<indicesPerFace {
            let idx = faceIndex * indicesPerFace + i
            let byteOffset = idx * MemoryLayout<UInt32>.size
            
            // Accéder de manière sécurisée à l'index
            let indexPtr = indexRawPointer.advanced(by: byteOffset).assumingMemoryBound(to: UInt32.self)
            meshFaces.append(NSNumber(value: indexPtr.pointee))
          }
        }
      }
    }
    
    // Log des résultats
    print("Extraction complete: Found \(meshAnchorsCount) mesh anchors, extracted \(meshVertices.count/3) vertices and \(meshFaces.count/3) faces")
    
    // Mettre à jour les données dans le module principal sur le thread principal
    DispatchQueue.main.async {
      self.module?.updateMeshData(vertices: meshVertices, faces: meshFaces)
    }
  }
}
