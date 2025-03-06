// components/ObjectDetectionScene.js
import React, { useState } from 'react';
import {
  ViroARScene,
  ViroBox,
  ViroMaterials,
  ViroText,
  ViroConstants,
  ViroARPlane,
  ViroAmbientLight,
  ViroDirectionalLight
} from '@reactvision/react-viro';

// Définir les matériaux pour notre scène AR
ViroMaterials.createMaterials({
  planeMaterial: {
    diffuseColor: 'rgba(255, 255, 255, 0.2)',
    lightingModel: 'Blinn'
  },
  objectBoxMaterial: {
    diffuseColor: 'rgba(0, 200, 120, 0.6)',
    lightingModel: 'Blinn'
  },
  selectedBoxMaterial: {
    diffuseColor: 'rgba(30, 100, 200, 0.6)',
    lightingModel: 'Blinn'
  }
});

// Scène AR pour la détection d'objets
const ObjectDetectionScene = (props) => {
  // États locaux
  const [planeSurfaces, setPlaneSurfaces] = useState([]);
  const [trackingState, setTrackingState] = useState('initializing');

  // Récupérer les props
  const {
    onTap,
    objectPosition,
    objectDimensions,
    stage
  } = props.sceneNavigator.viroAppProps || {};

  // Gestionnaire d'événements pour l'initialisation de la scène AR
  const onInitialized = (state, reason) => {
    if (state === ViroConstants.TRACKING_NORMAL) {
      setTrackingState('normal');
    } else if (state === ViroConstants.TRACKING_NONE) {
      setTrackingState('none');
    }
  };

  // Gestionnaire pour les plans détectés
  const onPlaneDetected = (anchor) => {
    setPlaneSurfaces(prevSurfaces => {
      // Vérifier si on a déjà ce plan
      const exists = prevSurfaces.some(surface => surface.id === anchor.uuid);
      if (exists) {
        return prevSurfaces.map(surface =>
          surface.id === anchor.uuid ? { ...surface, ...anchor } : surface
        );
      } else {
        return [
          ...prevSurfaces,
          {
            id: anchor.uuid,
            alignment: anchor.alignment,
            width: anchor.extent[0],
            length: anchor.extent[2],
            center: anchor.center,
            rotation: anchor.rotation
          }
        ];
      }
    });
  };

  // Gestionnaire pour les clics sur l'écran
  const onARHitTest = (results, position, source) => {
    if (typeof onTap === 'function') {
      onTap(position);
    }
  };

  return (
    <ViroARScene onTrackingUpdated={onInitialized} onHitTest={onARHitTest}>
      {/* Éclairage */}
      <ViroAmbientLight color="#FFFFFF" intensity={200} />
      <ViroDirectionalLight
        color="#FFFFFF"
        direction={[0, -1, -0.2]}
        intensity={300}
      />

      {/* Visualisation des surfaces détectées */}
      {planeSurfaces.map(plane => (
        <ViroARPlane
          key={plane.id}
          anchorId={plane.id}
          alignment={plane.alignment}
          minHeight={0.1}
          minWidth={0.1}
          materials={['planeMaterial']}
          opacity={0.2}
        />
      ))}

      {/* Visualisation de l'objet détecté */}
      {objectPosition && (
        <ViroBox
          position={[objectPosition.x, objectPosition.y, objectPosition.z]}
          scale={[
            objectDimensions?.width || 0.2,
            objectDimensions?.height || 0.2,
            objectDimensions?.depth || 0.2
          ]}
          materials={[stage === 'readyForScan' ? 'selectedBoxMaterial' : 'objectBoxMaterial']}
        />
      )}

      {/* Instructions pour l'utilisateur */}
      {trackingState === 'normal' && planeSurfaces.length === 0 && (
        <ViroText
          text="Déplacez votre téléphone pour détecter des surfaces"
          scale={[0.02, 0.02, 0.02]}
          position={[0, 0, -1]}
          style={{ color: 'white', fontSize: 20, textAlignVertical: 'center', textAlign: 'center' }}
        />
      )}

      {trackingState !== 'normal' && (
        <ViroText
          text="Déplacez lentement votre téléphone pour initialiser le tracking"
          scale={[0.02, 0.02, 0.02]}
          position={[0, 0, -1]}
          style={{ color: 'white', fontSize: 20, textAlignVertical: 'center', textAlign: 'center' }}
        />
      )}
    </ViroARScene>
  );
};

export default ObjectDetectionScene;