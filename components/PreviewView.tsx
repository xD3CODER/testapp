import React, { useEffect, useState, useRef } from "react";
import {
  ViroScene,
  Viro3DSceneNavigator,
  ViroAmbientLight,
  ViroOrbitCamera,
  ViroSphere,
  ViroMaterials,
    ViroNode,
  ViroDirectionalLight,
  ViroText,
  ViroBox
} from '@reactvision/react-viro';
import { View, Text } from 'react-native';

// Couleurs prédéfinies pour limiter le nombre de matériaux
const PREDEFINED_COLORS = [
  [1.0, 0.0, 0.0], // Rouge
  [0.0, 1.0, 0.0], // Vert
  [0.0, 0.0, 1.0], // Bleu
  [1.0, 1.0, 0.0], // Jaune
  [1.0, 0.0, 1.0], // Magenta
  [0.0, 1.0, 1.0], // Cyan
  [1.0, 0.5, 0.0], // Orange
  [0.5, 0.0, 1.0]  // Violet
];

// Initialiser les matériaux une seule fois pour tous les points
const initializeMaterials = () => {
  const materials = {};

  // Créer un matériau pour chaque couleur prédéfinie
  PREDEFINED_COLORS.forEach((color, index) => {
    materials[`pointColor${index}`] = {
      diffuseColor: `rgb(${Math.floor(color[0] * 255)}, ${Math.floor(color[1] * 255)}, ${Math.floor(color[2] * 255)})`,
      lightingModel: "Lambert"
    };
  });

  // Ajouter quelques matériaux supplémentaires
  materials.backgroundMaterial = {
    diffuseColor: 'rgb(20, 30, 50)',
    lightingModel: "Constant"
  };

  materials.defaultPointMaterial = {
    diffuseColor: 'rgb(200, 200, 200)',
    lightingModel: "Lambert"
  };

  // Créer tous les matériaux en une fois
  ViroMaterials.createMaterials(materials);

  console.log("Matériaux initialisés pour le ModelViewer");
};

// Scène 3D pour la prévisualisation
const PreviewARScene = ({ scanData }) => {
  const [sceneReady, setSceneReady] = useState(false);
  const [modelStats, setModelStats] = useState({
    centerX: 0,
    centerY: 0,
    centerZ: 0,
    maxSize: 1,
    pointCount: 0
  });

  // Référence pour éviter les calculs répétés
  const processedDataRef = useRef(null);

  // Fonction pour obtenir le matériau en fonction d'une couleur
  const getMaterialForColor = (color) => {
    if (!color || !Array.isArray(color) || color.length < 3) {
      return "defaultPointMaterial";
    }

    // Calculer un index de 0 à 7 basé sur la couleur
    const r = Math.floor(color[0] * 3.99);
    const g = Math.floor(color[1] * 1.99);
    const index = (r + g) % 8;

    return `pointColor${index}`;
  };

  // Analyser et centrer les données de scan
  useEffect(() => {
    // Si aucune donnée n'est disponible, ne rien faire
    if (!scanData || !scanData.points || scanData.points.length === 0) {
      console.log("Aucune donnée de scan disponible");
      return;
    }

    console.log(`Analyse de ${scanData.points.length} points de scan`);

    try {
      // Calculer les statistiques du modèle
      const points = scanData.points;
      const pointCount = points.length;

      // Variables pour les limites et le centre
      let sumX = 0, sumY = 0, sumZ = 0;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      let validPointCount = 0;

      // Analyser tous les points
      for (let i = 0; i < pointCount; i++) {
        const point = points[i];
        if (Array.isArray(point) && point.length >= 3 &&
            !isNaN(point[0]) && !isNaN(point[1]) && !isNaN(point[2])) {

          sumX += point[0];
          sumY += point[1];
          sumZ += point[2];

          minX = Math.min(minX, point[0]);
          maxX = Math.max(maxX, point[0]);
          minY = Math.min(minY, point[1]);
          maxY = Math.max(maxY, point[1]);
          minZ = Math.min(minZ, point[2]);
          maxZ = Math.max(maxZ, point[2]);

          validPointCount++;
        }
      }

      // S'assurer qu'il y a des points valides
      if (validPointCount === 0) {
        console.log("Aucun point valide dans les données");
        return;
      }

      // Calculer le centre
      const centerX = sumX / validPointCount;
      const centerY = sumY / validPointCount;
      const centerZ = sumZ / validPointCount;

      // Calculer la taille
      const sizeX = maxX - minX;
      const sizeY = maxY - minY;
      const sizeZ = maxZ - minZ;
      const maxSize = Math.max(sizeX, sizeY, sizeZ, 1);

      // Mettre à jour les statistiques
      setModelStats({
        centerX,
        centerY,
        centerZ,
        maxSize,
        pointCount: validPointCount
      });

      // Centrer les points
      const centeredPoints = [];

      for (let i = 0; i < pointCount; i++) {
        const point = points[i];
        if (Array.isArray(point) && point.length >= 3 &&
            !isNaN(point[0]) && !isNaN(point[1]) && !isNaN(point[2])) {

          centeredPoints.push([
            point[0] - centerX,
            point[1] - centerY,
            point[2] - centerZ
          ]);
        }
      }

      // Stocker les données traitées dans la référence
      processedDataRef.current = {
        points: centeredPoints,
        colors: scanData.colors || [],
        stats: {
          centerX,
          centerY,
          centerZ,
          maxSize,
          pointCount: validPointCount
        }
      };

      console.log(`Modèle analysé: taille=${maxSize.toFixed(2)}m, points=${validPointCount}`);
    } catch (error) {
      console.error("Erreur lors de l'analyse des données:", error);
    }
  }, [scanData]);

  // Gérer l'initialisation de la scène
  const handleSceneInitialized = () => {
    console.log("Scène initialisée");
    setSceneReady(true);
  };

  // Rendu des points 3D
  const renderPoints = () => {
    if (!processedDataRef.current) return null;

    return processedDataRef.current.points.map((point, index) => {
      // Échantillonnage pour éviter trop de points
      // Afficher au maximum 1000 points
      const samplingStep = Math.max(1, Math.floor(processedDataRef.current.points.length / 1000));
      if (index % samplingStep !== 0) return null;

      // Vérifier la validité du point
      if (!point || !Array.isArray(point) || point.length < 3 ||
          isNaN(point[0]) || isNaN(point[1]) || isNaN(point[2])) {
        return null;
      }

      // Obtenir la couleur
      const material = processedDataRef.current.colors && processedDataRef.current.colors[index]
        ? getMaterialForColor(processedDataRef.current.colors[index])
        : "defaultPointMaterial";

      return (
        <ViroSphere
          key={`point-${index}`}
          position={point}
          radius={0.015}
          facesOutward={false}
          materials={[material]}
        />
      );
    });
  };

  // Rendu du message d'information
  const renderInfoText = () => {
    if (!processedDataRef.current) {
      return (
        <ViroText
          text="Aucune donnée de scan disponible"
          position={[0, 0, -2]}
          style={{
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#ffffff',
            textAlignVertical: 'center',
            textAlign: 'center'
          }}
        />
      );
    }

    return (
      <ViroText
        text={`${processedDataRef.current.stats.pointCount} points • ${Math.round(processedDataRef.current.stats.maxSize * 100) / 100}m`}
        position={[0, -1, -3]}
        style={{
          fontFamily: 'Arial',
          fontSize: 14,
          color: '#ffffff',
          textAlignVertical: 'center',
          textAlign: 'center'
        }}
      />
    );
  };

  return (
    <ViroScene onInitialized={handleSceneInitialized}>
      {/* Éclairage */}
      <ViroAmbientLight color="#ffffff" intensity={400} />
      <ViroDirectionalLight direction={[0, -1, -1]} color="#ffffff" intensity={0.6} />
      <ViroDirectionalLight direction={[0, 1, -0.5]} color="#ffffff" intensity={0.3} />
      <ViroDirectionalLight direction={[1, 0, -0.5]} color="#ffffff" intensity={0.3} />

      {/* Caméra active seulement quand la scène est prête */}
      {sceneReady &&
        <ViroOrbitCamera
          position={[0, 0, modelStats.maxSize * 5]}
          focalPoint={[0, 0, 0]}
          active={true}
        />
      }

      {/* Fond */}
      <ViroBox
        position={[0, 0, -15]}
        scale={[30, 30, 0.1]}
        materials={["backgroundMaterial"]}
      />
<ViroNode
  position={[0, 0, 0]}
  animation={{
    name: "rotate",
    run: true,
    loop: true,
    duration: 4000
  }}
>
      {/* Nuage de points */}
      {renderPoints()}
</ViroNode>

      {/* Texte d'information */}
      {renderInfoText()}
    </ViroScene>
  );
};

// Composant principal
const ModelViewer = ({ scanData }) => {
  useEffect(() => {
    // Initialiser les matériaux au montage
    initializeMaterials();
  }, []);

  console.log(scanData)
  return (
    <Viro3DSceneNavigator
      initialScene={{
        scene: PreviewARScene,
        passProps: { scanData }
      }}
      style={{ flex: 1 }}
    />
  );
};

export default ModelViewer;