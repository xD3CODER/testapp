import SceneKit
import ARKit
import UIKit

// Extension pour la création de primitives SCNGeometry
extension SCNGeometry {
    /// Créer un cercle
    static func circle(radius: CGFloat, segments: Int) -> SCNGeometry {
        let path = UIBezierPath(arcCenter: CGPoint(x: 0, y: 0),
                                radius: radius,
                                startAngle: 0,
                                endAngle: CGFloat(2.0 * Double.pi),
                                clockwise: true)

        return SCNShape(path: path, extrusionDepth: 0.01)
    }

    /// Créer une géométrie à partir d'un ARMeshAnchor
    @available(iOS 13.4, *)
    static func fromMeshAnchor(_ meshAnchor: ARMeshAnchor) -> SCNGeometry {
        let vertices = meshAnchor.geometry.vertices
        let faces = meshAnchor.geometry.faces

        let vertexSource = SCNGeometrySource(buffer: vertices.buffer,
                                            vertexFormat: vertices.format,
                                            semantic: .vertex,
                                            vertexCount: vertices.count,
                                            dataOffset: vertices.offset,
                                            dataStride: vertices.stride)

        let faceData = Data(bytesNoCopy: faces.buffer.contents(),
                           count: faces.buffer.length,
                           deallocator: .none)

        let faceElement = SCNGeometryElement(data: faceData,
                                           primitiveType: .triangles,
                                           primitiveCount: faces.count,
                                           bytesPerIndex: faces.bytesPerIndex)

        return SCNGeometry(sources: [vertexSource], elements: [faceElement])
    }
}

extension CGPoint {
    var center: CGPoint {
        return self
    }
}
extension CGRect {
    var center: CGPoint {
        return CGPoint(x: self.midX, y: self.midY)
    }
}
