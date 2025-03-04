// MaterialManager.js
import { ViroMaterials } from '@reactvision/react-viro';

// Cache pour les matériaux
const createdMaterials = new Set();

// Initialisation des matériaux de base
export const initializeMaterials = () => {
  try {
    // Matériaux pour les surfaces et le fond
    const basicMaterials = {
      surfaceMaterial: {
        diffuseColor: 'rgba(100, 180, 255, 0.3)',
        lightingModel: "Lambert"
      },
      previewBackgroundMaterial: {
        diffuseColor: 'rgb(20, 30, 50)',
        lightingModel: "Constant"
      }
    };

    // Matériaux pour les points (palette de couleurs)
    const pointColors = {
      pointColor0: { diffuseColor: 'rgb(255, 0, 0)', lightingModel: "Lambert" },    // Rouge
      pointColor1: { diffuseColor: 'rgb(0, 255, 0)', lightingModel: "Lambert" },    // Vert
      pointColor2: { diffuseColor: 'rgb(0, 0, 255)', lightingModel: "Lambert" },    // Bleu
      pointColor3: { diffuseColor: 'rgb(255, 255, 0)', lightingModel: "Lambert" },  // Jaune
      pointColor4: { diffuseColor: 'rgb(255, 0, 255)', lightingModel: "Lambert" },  // Magenta
      pointColor5: { diffuseColor: 'rgb(0, 255, 255)', lightingModel: "Lambert" },  // Cyan
      pointColor6: { diffuseColor: 'rgb(255, 128, 0)', lightingModel: "Lambert" },  // Orange
      pointColor7: { diffuseColor: 'rgb(128, 0, 255)', lightingModel: "Lambert" }   // Violet
    };

    // Combiner tous les matériaux
    const materials = {
      ...basicMaterials,
      ...pointColors
    };

    // Créer tous les matériaux d'un coup
    ViroMaterials.createMaterials(materials);

    // Ajouter au cache
    Object.keys(materials).forEach(key => createdMaterials.add(key));

    console.log("Matériaux initialisés avec succès");
    return true;
  } catch (error) {
    console.error("Erreur lors de l'initialisation des matériaux:", error);
    return false;
  }
};

// Vérifier si un matériau existe
export const materialExists = (name) => {
  return createdMaterials.has(name);
};

// Créer un matériau dynamiquement
export const createMaterial = (name, properties) => {
  try {
    if (createdMaterials.has(name)) {
      return true; // Déjà existant
    }

    // Créer le matériau
    const materialDef = {};
    materialDef[name] = properties;

    ViroMaterials.createMaterials(materialDef);
    createdMaterials.add(name);

    return true;
  } catch (error) {
    console.error(`Erreur création matériau ${name}:`, error);
    return false;
  }
};

// Obtenir l'index de couleur pour un point
export const getPointColorIndex = (color) => {
  if (!Array.isArray(color) || color.length < 3) return 0;

  // Calculer un index basé sur la couleur
  const r = Math.floor(color[0] * 3.99);
  const g = Math.floor(color[1] * 1.99);
  return (r + g) % 8;
};

// Obtenir le nom du matériau pour un point
export const getPointMaterialName = (color) => {
  const index = getPointColorIndex(color);
  return `pointColor${index}`;
};

// Prédéfinir les couleurs (pour usage direct avec color=)
export const PREDEFINED_COLORS = [
  "#FF0000", // Rouge
  "#00FF00", // Vert
  "#0000FF", // Bleu
  "#FFFF00", // Jaune
  "#FF00FF", // Magenta
  "#00FFFF", // Cyan
  "#FF8000", // Orange
  "#8000FF"  // Violet
];