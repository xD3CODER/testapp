import ExpoModulesCore
import SwiftUI
import RealityKit
import ObjectiveC
import os

private let logger = Logger()

public class ExpoObjectQuickModule: Module {

    public func definition() -> ModuleDefinition {
        // Définir le nom du module
        Name("ExpoObjectQuick")
        
        // Définir la vue
        View(ExpoObjectQuickView.self) {
            Prop("filePath") { (view: ExpoObjectQuickView, filePath: String) in
                view.filePath = filePath
            }
        }
    }
 }
