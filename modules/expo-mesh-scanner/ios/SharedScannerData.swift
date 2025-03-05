import UIKit

// Classe partagée pour les données entre le module et la vue
public class SharedScannerData {
    public static let shared = SharedScannerData()

    public var targetObject: CGRect?
    public var isScanning = false

    private init() {}
}