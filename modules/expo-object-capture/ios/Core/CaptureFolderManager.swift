/*
See the LICENSE.txt file for this sample’s licensing information.

Abstract:
A class to support the creation, listing, and filename support of a
 capture folder in the Documents directory which will contain three
 subdirectories --- one for images, one for reconstruction checkpoint,
 and one for the created model.
*/

import Foundation
import os

private let logger = Logger(subsystem: ExpoGuidedCapture.subsystem,
                            category: "CaptureFolderManager")

@Observable
class CaptureFolderManager {
    enum Error: Swift.Error {
        case notFileUrl
        case creationFailed
        case alreadyExists
        case invalidShotUrl
    }

    // The app's documents folder that includes captures from all sessions.
    let appDocumentsFolder: URL = URL.documentsDirectory

    // Top-level capture directory that contains imagesFolder, checkpointFolder, and modelsFolder.
    // Automatically created at init() with timestamp.
    let captureFolder: URL

    // Subdirectory of captureFolder to store the images.
    let imagesFolder: URL

    // Subdirectory of captureFolder to store the reconstruction checkpoint.
    let checkpointFolder: URL

    // Subdirectory of captureFolder to store the created model.
    let modelsFolder: URL

    static let imagesFolderName = "Images/"

    init() throws {
        guard let newFolder = CaptureFolderManager.createNewCaptureDirectory() else {
            throw Error.creationFailed
        }
        captureFolder = newFolder

        // Create the subdirectories
        imagesFolder = newFolder.appendingPathComponent(Self.imagesFolderName)
        try CaptureFolderManager.createDirectoryRecursively(imagesFolder)

        checkpointFolder = newFolder.appendingPathComponent("Checkpoint/")
        try CaptureFolderManager.createDirectoryRecursively(checkpointFolder)

        modelsFolder = newFolder.appendingPathComponent("Models/")
        try CaptureFolderManager.createDirectoryRecursively(modelsFolder)
    }

    // - MARK: Private interface below.

    // Creates a new capture directory based on the current timestamp in the top level Documents
    // folder. Otherwise, returns nil on failure.
    // Contains Images and Checkpoint subdirectories.
    //
    // - Returns: the created folder's file URL, else nil on error.
    // Dans CaptureFolderManager.swift, modifiez la méthode createNewCaptureDirectory

private static func createNewCaptureDirectory() -> URL? {
    // Format de date avec millisecondes
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let timestamp = formatter.string(from: Date())

    // Ajouter un identifiant unique pour garantir l'unicité
    let uniqueID = UUID().uuidString.prefix(8)
    let folderName = "\(timestamp)-\(uniqueID)"

    let newCaptureDir = URL.documentsDirectory
        .appendingPathComponent(folderName, isDirectory: true)

    logger.log("Creating capture path: \"\(String(describing: newCaptureDir))\"")

    // Vérifier d'abord si le dossier existe déjà
    if FileManager.default.fileExists(atPath: newCaptureDir.path) {
        logger.error("Folder already exists at path: \(newCaptureDir.path)")
        return nil
    }

    let capturePath = newCaptureDir.path
    do {
        try FileManager.default.createDirectory(atPath: capturePath,
                                               withIntermediateDirectories: true)
    } catch {
        logger.error("Failed to create capturepath=\"\(capturePath)\" error=\(String(describing: error))")
        return nil
    }

    // Vérification supplémentaire
    var isDir: ObjCBool = false
    let exists = FileManager.default.fileExists(atPath: capturePath, isDirectory: &isDir)
    guard exists && isDir.boolValue else {
        logger.error("Directory creation check failed for: \(capturePath)")
        return nil
    }

    return newCaptureDir
}

    // Creates all path components until it exists, else throws.
    // Throws if the file already exists as well.
    private static func createDirectoryRecursively(_ outputDir: URL) throws {
        guard outputDir.isFileURL else {
            throw CaptureFolderManager.Error.notFileUrl
        }
        let expandedPath = outputDir.path
        var isDirectory: ObjCBool = false

        guard !FileManager.default.fileExists(atPath: outputDir.path, isDirectory: &isDirectory) else {
            logger.error("File already exists at \(expandedPath, privacy: .private)")
            throw CaptureFolderManager.Error.alreadyExists
        }

        logger.log("Creating dir recursively: \"\(expandedPath, privacy: .private)\"")
        try FileManager.default.createDirectory(atPath: expandedPath,
                               withIntermediateDirectories: true)

        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: expandedPath, isDirectory: &isDir) && isDir.boolValue else {
            logger.error("Dir \"\(expandedPath, privacy: .private)\" doesn't exist after creation!")
            throw CaptureFolderManager.Error.creationFailed
        }
        logger.log("... success creating dir.")
    }

    // What is appended in front of the capture id to get a file basename.
    private static let imageStringPrefix = "IMG_"
    private static let heicImageExtension = "HEIC"
}
