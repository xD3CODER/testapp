// SharedModels.swift
import Foundation
import RealityKit

enum ScanState: String {
    case notStarted
    case ready
    case detecting
    case objectDetected
    case capturing
    case completed
    case processing
    case finished
    case error
}

enum CaptureMode: String {
    case object
    case area
}

struct ObjectDimensions {
    var width: Float = 0.2
    var height: Float = 0.2
    var depth: Float = 0.2
}

struct ObjectPosition {
    var x: Float = 0.0
    var y: Float = 0.0
    var z: Float = 0.0
}
