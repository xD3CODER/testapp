import ExpoModulesCore
import RealityKit
import SwiftUI

public class ExpoObjectQuickView: ExpoView {
    private var hostingController: UIHostingController<AnyView>?
    static var currentInstance: ExpoObjectQuickView?
    var filePath = ""
       
    let onViewReady = EventDispatcher()

    required public init(appContext: AppContext? = nil) {
        
        super.init(appContext: appContext)
        
        ExpoObjectQuickView.currentInstance = self
        
        let url = URL(fileURLWithPath: filePath)
          let initialView = UIHostingController(rootView:
              AnyView(
                  ZStack {
                      Color.black.edgesIgnoringSafeArea(.all)
                      Text("En attente de la session de capture...")
                          .foregroundColor(.white)
                          .font(.headline)
                  }
              )
          )
          initialView.view.frame = bounds
          initialView.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
          addSubview(initialView.view)
          hostingController = initialView
    }
}
