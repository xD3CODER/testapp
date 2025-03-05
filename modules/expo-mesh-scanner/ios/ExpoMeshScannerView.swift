import ExpoModulesCore
import ARKit
import SceneKit
import UIKit

class ExpoMeshScannerView: ExpoView, ARSCNViewDelegate, ARSessionDelegate {
    // Propriétés du composant
    private let arView = ARSCNView()
    private var arSession: ARSession?
    private var isInitialized = false
    private var isScanning = false
    private var targetObjectNode: SCNNode?
    private var meshNodes: [UUID: SCNNode] = [:]
    private var capturedImageNodes: [SCNNode] = []
    private var guideNodes: [SCNNode] = []
    private var guidePath: SCNNode?
    
    // Événements exposés à JavaScript
    let onInitialized = EventDispatcher()
    let onTouch = EventDispatcher()
    let onTrackingStateChanged = EventDispatcher()
    
    // Propriétés pour le suivi de la position
    private var initialPosition: simd_float4x4?
    private var initialAngle: Float = 0
    private var targetObject: CGRect?
    
    // Propriétés pour la visualisation
    private var scanPointsMaterial: SCNMaterial?
    private var guidePathMaterial: SCNMaterial?
    private var targetObjectMaterial: SCNMaterial?
    
    // Constantes pour la visualisation
    private let guideRadius: Float = 1.5
    private let guideDotRadius: CGFloat = 0.02
    private let meshOpacity: CGFloat = 0.6
    
    // Timer pour vérifier les mises à jour des données partagées
    private var dataSyncTimer: Timer?

    // Initialisation avec le contexte de l'application
    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)

        // Configurer la vue AR
        arView.delegate = self
        arView.session.delegate = self
        arView.autoenablesDefaultLighting = true
        arView.automaticallyUpdatesLighting = true

        // Configuration initiale du rendu
        configureMaterials()

        // Ajouter la vue AR comme sous-vue
        addSubview(arView)

        // Ajouter un gesture recognizer pour la sélection
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        arView.addGestureRecognizer(tapGesture)

        // Démarrer la synchronisation des données
        startDataSyncTimer()
    }

    // Configuration des matériaux pour le rendu
    private func configureMaterials() {
        // Matériau pour les points du scan
        scanPointsMaterial = SCNMaterial()
        scanPointsMaterial?.diffuse.contents = UIColor.cyan.withAlphaComponent(0.7)
        scanPointsMaterial?.lightingModel = .blinn

        // Matériau pour le chemin de guidage
        guidePathMaterial = SCNMaterial()
        guidePathMaterial?.diffuse.contents = UIColor.yellow
        guidePathMaterial?.emission.contents = UIColor.yellow.withAlphaComponent(0.5)
        guidePathMaterial?.lightingModel = .constant

        // Matériau pour l'objet cible
        targetObjectMaterial = SCNMaterial()
        targetObjectMaterial?.diffuse.contents = UIColor.green.withAlphaComponent(0.3)
        targetObjectMaterial?.lightingModel = .blinn
    }

    // Mise à jour du layout
    override func layoutSubviews() {
        super.layoutSubviews()
        arView.frame = bounds
    }

    // Démarrer le timer de synchronisation des données
    private func startDataSyncTimer() {
        dataSyncTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self else { return }

            // Vérifier si les données partagées ont changé
            if let sharedTargetObject = SharedScannerData.shared.targetObject,
               (self.targetObject == nil || sharedTargetObject != self.targetObject) {
                self.targetObject = sharedTargetObject
                self.updateTargetObjectVisualization()
            }

            // Vérifier l'état du scan
            if SharedScannerData.shared.isScanning != self.isScanning {
                if SharedScannerData.shared.isScanning {
                    self.startScanning()
                } else {
                    self.stopScanning()
                }
            }
        }
    }

    // Mettre à jour l'affichage de l'objet cible
    private func updateTargetObjectVisualization() {
        guard let targetObject = self.targetObject else { return }

        // Supprimer l'ancien node s'il existe
        targetObjectNode?.removeFromParentNode()

        // Créer un nouveau node pour montrer la sélection
        let planeGeometry = SCNPlane(width: CGFloat(0.2), height: CGFloat(0.2))
        planeGeometry.firstMaterial = targetObjectMaterial

        let planeNode = SCNNode(geometry: planeGeometry)

        // Essayer de positionner le plan à l'endroit touché
        if let raycastQuery = arView.raycastQuery(from: targetObject.center, allowing: .estimatedPlane, alignment: .any),
           let raycastResult = arView.session.raycast(raycastQuery).first {
            planeNode.position = SCNVector3(
                raycastResult.worldTransform.columns.3.x,
                raycastResult.worldTransform.columns.3.y,
                raycastResult.worldTransform.columns.3.z
            )

            // Orienter vers la caméra
            planeNode.constraints = [SCNBillboardConstraint()]

            targetObjectNode = planeNode
            arView.scene.rootNode.addChildNode(planeNode)
        }
    }

    // MARK: - Méthodes publiques exposées à JavaScript

    // Initialisation de la vue AR
    @objc func initialize() {
        if isInitialized {
            return
        }

        // Configurer et démarrer la session AR
        if #available(iOS 13.4, *) {
            let configuration = ARWorldTrackingConfiguration()

            // Activer le mesh si disponible
            if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
                configuration.sceneReconstruction = .mesh
                configuration.environmentTexturing = .automatic
            }

            // Activer la détection de plans
            configuration.planeDetection = [.horizontal, .vertical]

            if #available(iOS 13.0, *) {
                configuration.frameSemantics = [.sceneDepth, .smoothedSceneDepth]
            }

            // Démarrer la session
            arView.session.run(configuration)
            arSession = arView.session
            isInitialized = true

            // Notifier JavaScript
            onInitialized([:])
        }
    }

    // Démarrer le scan
    @objc func startScanning() {
        isScanning = true
        clearGuides()
        createGuides()
    }

    // Terminer le scan
    @objc func stopScanning() {
        isScanning = false
        clearGuides()
    }

    // Définir la région de l'objet
    @objc func setTargetObject(rect: CGRect) {
        targetObject = rect
        // Mettre à jour les données partagées
        SharedScannerData.shared.targetObject = rect
        // Mettre à jour la visualisation
        updateTargetObjectVisualization()
    }

    // Mettre à jour la visualisation du mesh
    @objc func updateMeshVisualization(showMesh: Bool) {
        for (_, node) in meshNodes {
            node.isHidden = !showMesh
        }
    }

    // Mettre à jour la visualisation des guides
    @objc func updateGuideVisualization(showGuides: Bool) {
        for node in guideNodes {
            node.isHidden = !showGuides
        }
        guidePath?.isHidden = !showGuides
    }

    // Afficher les images capturées dans l'espace
    @objc func showCapturedImageLocations(show: Bool) {
        for node in capturedImageNodes {
            node.isHidden = !show
        }
    }

    // MARK: - Méthodes privées d'assistance

    // Gérer les taps sur l'écran
    @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
        let location = gesture.location(in: arView)

        // Convertir le point en coordonnées normalisées (0-1)
        let normalizedPoint = CGPoint(
            x: location.x / arView.bounds.width,
            y: location.y / arView.bounds.height
        )

        // Envoyer l'événement à JavaScript
        onTouch([
            "x": normalizedPoint.x,
            "y": normalizedPoint.y,
            "rawX": location.x,
            "rawY": location.y
        ])
    }

    // Créer les guides visuels pour le scan
    private func createGuides() {
        // Créer le cercle guide
        let guideLine = SCNGeometry.circle(radius: CGFloat(guideRadius), segments: 36)
        guideLine.firstMaterial = guidePathMaterial

        let guideLineNode = SCNNode(geometry: guideLine)
        guideLineNode.position = SCNVector3(0, -0.5, 0)
        guideLineNode.eulerAngles = SCNVector3(Float.pi/2, 0, 0) // Face vers le haut

        // Ajouter à la scène relative à la caméra
        if let cameraNode = arView.pointOfView {
            // Positionner le cercle guide autour de l'utilisateur
            let positionOffsetMatrix = simd_float4x4(
                SIMD4<Float>(1, 0, 0, 0),
                SIMD4<Float>(0, 1, 0, 0),
                SIMD4<Float>(0, 0, 1, 0),
                SIMD4<Float>(0, -0.5, 0, 1)
            )

            // Appliquer la transformation
            if let initialPosition = arView.session.currentFrame?.camera.transform {
                self.initialPosition = initialPosition

                // Calculer l'angle initial
                initialAngle = atan2(initialPosition.columns.0.z, initialPosition.columns.0.x)

                // Créer un node pour les guides
                let guidesNode = SCNNode()
                guidesNode.position = SCNVector3(
                    initialPosition.columns.3.x,
                    initialPosition.columns.3.y - 0.5, // Légèrement plus bas
                    initialPosition.columns.3.z
                )

                // Ajouter le cercle
                guidesNode.addChildNode(guideLineNode)

                // Ajouter des marqueurs tous les 45 degrés
                for angle in stride(from: 0.0, to: 360.0, by: 45.0) {
                    let markerNode = createGuideDot()
                    let angleRadians = Float(angle) * Float.pi / 180.0

                    // Positionner autour du cercle
                    markerNode.position = SCNVector3(
                        guideRadius * sin(angleRadians),
                        0,
                        guideRadius * cos(angleRadians)
                    )

                    guidesNode.addChildNode(markerNode)
                    guideNodes.append(markerNode)
                }

                // Ajouter le node principal à la scène
                arView.scene.rootNode.addChildNode(guidesNode)

                // Stocker une référence
                guidePath = guidesNode
            }
        }
    }

    // Nettoyer les guides
    private func clearGuides() {
        guidePath?.removeFromParentNode()
        guidePath = nil

        for node in guideNodes {
            node.removeFromParentNode()
        }
        guideNodes.removeAll()
    }

    // Créer un marqueur de guide (point)
    private func createGuideDot() -> SCNNode {
        let dot = SCNSphere(radius: guideDotRadius)
        dot.firstMaterial = guidePathMaterial

        let dotNode = SCNNode(geometry: dot)
        return dotNode
    }

    // Ajouter un marqueur pour une image capturée
    func addCapturedImageMarker(at position: SCNVector3, angle: Float) {
        let marker = SCNBox(width: 0.05, height: 0.05, length: 0.01, chamferRadius: 0.01)
        marker.firstMaterial?.diffuse.contents = UIColor.white

        let markerNode = SCNNode(geometry: marker)
        markerNode.position = position

        // Orienter le marqueur dans la direction de la caméra
        markerNode.eulerAngles = SCNVector3(0, angle, 0)

        // Ajouter une icône de caméra (texte simple pour l'exemple)
        let cameraText = SCNText(string: "📷", extrusionDepth: 0)
        cameraText.font = UIFont.systemFont(ofSize: 0.5)
        cameraText.firstMaterial?.diffuse.contents = UIColor.white

        let cameraTextNode = SCNNode(geometry: cameraText)
        cameraTextNode.scale = SCNVector3(0.01, 0.01, 0.01)
        cameraTextNode.position = SCNVector3(0, 0, 0.006)

        markerNode.addChildNode(cameraTextNode)
        arView.scene.rootNode.addChildNode(markerNode)

        capturedImageNodes.append(markerNode)
    }

    // Mettre à jour l'indicateur de position actuelle
    func updatePositionIndicator(angle: Float) {
        guard let guidePath = guidePath else { return }

        // Calculer la différence d'angle par rapport à l'initial
        let angleDifference = angle - initialAngle

        // Créer ou mettre à jour l'indicateur de position
        if let existingIndicator = guidePath.childNode(withName: "positionIndicator", recursively: false) {
            // Mettre à jour la position
            let x = guideRadius * sin(angleDifference)
            let z = guideRadius * cos(angleDifference)

            // Animer le déplacement
            let moveAction = SCNAction.move(to: SCNVector3(x, 0, z), duration: 0.2)
            existingIndicator.runAction(moveAction)
        } else {
            // Créer un nouvel indicateur
            let indicator = SCNSphere(radius: guideDotRadius * 1.5)
            indicator.firstMaterial?.diffuse.contents = UIColor.red
            indicator.firstMaterial?.emission.contents = UIColor.red.withAlphaComponent(0.5)

            let indicatorNode = SCNNode(geometry: indicator)
            indicatorNode.name = "positionIndicator"

            // Positionner sur le cercle
            let x = guideRadius * sin(angleDifference)
            let z = guideRadius * cos(angleDifference)
            indicatorNode.position = SCNVector3(x, 0, z)

            guidePath.addChildNode(indicatorNode)
        }
    }

    // MARK: - ARSCNViewDelegate

    // Gestionnaire pour les anchors ajoutés
    func renderer(_ renderer: SCNSceneRenderer, didAdd node: SCNNode, for anchor: ARAnchor) {
        // Visualisation des ancres de mesh (si LiDAR disponible)
        if #available(iOS 13.4, *), let meshAnchor = anchor as? ARMeshAnchor {
            // Créer un node pour visualiser le mesh
            let geometry = SCNGeometry.fromMeshAnchor(meshAnchor)
            geometry.firstMaterial = scanPointsMaterial

            // Créer le node et l'ajouter à la scène
            let meshNode = SCNNode(geometry: geometry)
            meshNode.opacity = meshOpacity
            node.addChildNode(meshNode)

            // Stocker une référence
            meshNodes[meshAnchor.identifier] = meshNode
        }
    }

    // Gestionnaire pour les anchors mises à jour
    func renderer(_ renderer: SCNSceneRenderer, didUpdate node: SCNNode, for anchor: ARAnchor) {
        // Mettre à jour la visualisation des meshes (si LiDAR disponible)
        if #available(iOS 13.4, *), let meshAnchor = anchor as? ARMeshAnchor {
            if let meshNode = meshNodes[meshAnchor.identifier] {
                // Mettre à jour la géométrie
                let updatedGeometry = SCNGeometry.fromMeshAnchor(meshAnchor)
                updatedGeometry.firstMaterial = scanPointsMaterial

                // Appliquer la nouvelle géométrie
                meshNode.geometry = updatedGeometry
            }
        }
    }

    // Gestionnaire pour les anchors supprimées
    func renderer(_ renderer: SCNSceneRenderer, didRemove node: SCNNode, for anchor: ARAnchor) {
        if let meshAnchor = anchor as? ARMeshAnchor {
            // Supprimer la référence
            meshNodes.removeValue(forKey: meshAnchor.identifier)
        }
    }

    // MARK: - ARSessionDelegate

    // Gestionnaire de mise à jour de frame
    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        if isScanning {
            // Mettre à jour l'indicateur de position
            let camera = frame.camera
            let currentAngle = atan2(camera.transform.columns.0.z, camera.transform.columns.0.x)
            let angleDegrees = (currentAngle * 180 / Float.pi).truncatingRemainder(dividingBy: 360)

            // Mettre à jour la visualisation
            updatePositionIndicator(angle: currentAngle)
        }
    }

    // Gestionnaire de changement d'état de tracking
    func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
        // Notifier JavaScript du changement d'état
        var stateString: String

        switch camera.trackingState {
        case .normal:
            stateString = "normal"
        case .limited(let reason):
            switch reason {
            case .excessiveMotion: stateString = "limited.excessiveMotion"
            case .insufficientFeatures: stateString = "limited.insufficientFeatures"
            case .initializing: stateString = "limited.initializing"
            case .relocalizing: stateString = "limited.relocalizing"
            @unknown default: stateString = "limited.unknown"
            }
        case .notAvailable:
            stateString = "notAvailable"
        @unknown default:
            stateString = "unknown"
        }

        onTrackingStateChanged(["state": stateString])
    }

    // Nettoyage lors de la suppression
    deinit {
        dataSyncTimer?.invalidate()
        dataSyncTimer = nil
    }
}