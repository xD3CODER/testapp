
Pod::Spec.new do |s|
  s.name           = 'ExpoMeshScanner'
  s.version        = '0.1.0'
  s.summary        = '3D Mesh Scanning module using ARKit'
  s.description    = 'Native module that provides 3D mesh scanning capabilities using ARKit'
  s.author         = 'Your Name'
  s.homepage       = 'https://github.com/yourusername/expo-mesh-scanner'
  s.platform       = :ios, '13.0'
  s.source         = { git: 'https://github.com/yourusername/expo-mesh-scanner.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  
  # Ajouter ARKit et Metal comme dépendances
  s.dependency 'ARKit'
  s.framework = 'Metal'
  
  # Pour iOS 13.4+ (nécessaire pour SceneReconstruction)
  s.deployment_target = '13.4'

  # Swift/ObjC compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
  
  s.source_files = "**/*.{h,m,mm,swift}"
end