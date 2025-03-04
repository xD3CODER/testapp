// ScanARScene.js - Version optimisée avec sélection d'objet
import React, { useState, useRef, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';

import {
  ViroARScene,
  ViroText,
  ViroNode,
  ViroARPlaneSelector,
  ViroQuad,
  ViroTrackingStateConstants,
  ViroAmbientLight,
  ViroSphere,
  ViroConstants
} from '@reactvision/react-viro';

// Scène AR pour le scan
const ScanARScene = (props) => {
  const {
    isScanning,
    selectionMode,
    objectSelected,
    objectCenter,
    onScanProgress,
    onSurfaceFound,
    onScanComplete,
    onObjectSelected,
    parentSurfaceFound
  } = props;

  const [trackingStatus, setTrackingStatus] = useState('Initialisation...');
  const [pointCloud, setPointCloud] = useState([]);
  const [colorData, setColorData] = useState([]);
  const [selectionMarker, setSelectionMarker] = useState(null);

  const arSceneRef = useRef(null);
  const simulationTimerRef = useRef(null);
  const cameraPositionsRef = useRef([]);
  const scanStartTimeRef = useRef(null);

  // Effet pour mise à jour de statut et marqueur
  useEffect(() => {
    // Mettre à jour le marqueur quand l'objet est sélectionné
    if (objectCenter && !selectionMarker) {
      setSelectionMarker(objectCenter);
    }

    // Mise à jour du statut
    if (selectionMode) {
      setTrackingStatus('Pointez vers l\'objet à scanner');
    } else if (objectSelected && !isScanning) {
      setTrackingStatus('Objet sélectionné. Prêt à scanner.');
    } else if (isScanning) {
      setTrackingStatus('Scan en cours...');
    } else {
      setTrackingStatus('Cherchez une surface ou sélectionnez un objet...');
    }
  }, [selectionMode, objectSelected, isScanning, objectCenter, selectionMarker]);

  // Ajouter des points au nuage de points
  const addPoints = (newPoints, newColors) => {
    if (newPoints.length === 0) return;

    console.log(`Ajout de ${newPoints.length} nouveaux points`);

    // Mettre à jour directement
    setPointCloud(prev => {
      // Limiter à 2000 points maximum (augmenté)
      const combinedPoints = [...prev, ...newPoints];
      if (combinedPoints.length > 2000) {
        return combinedPoints.slice(0, 2000);
      }
      return combinedPoints;
    });

    setColorData(prev => {
      // Assurer la cohérence avec pointCloud
      const combinedColors = [...prev, ...newColors];
      if (combinedColors.length > 2000) {
        return combinedColors.slice(0, 2000);
      }
      return combinedColors;
    });

    // Informer le parent
    onScanProgress && onScanProgress(newPoints.length);
  };

  // Écouteurs d'événements
  useEffect(() => {
    console.log("Configuration des écouteurs");

    // Démarrer le scan
    const startListener = DeviceEventEmitter.addListener('START_SCAN', () => {
      console.log("START_SCAN reçu");
      setTrackingStatus('Scan en cours...');
      setPointCloud([]);
      setColorData([]);
      cameraPositionsRef.current = [];
      scanStartTimeRef.current = Date.now();

      // Démarrer la capture
      setTimeout(() => {
        startPointCapture();
      }, 100);
    });

    // Arrêter le scan
    const stopListener = DeviceEventEmitter.addListener('STOP_SCAN', () => {
      console.log("STOP_SCAN reçu");
      setTrackingStatus(objectSelected ?
        'Objet sélectionné. Prêt à scanner.' :
        'Cherchez une surface ou sélectionnez un objet...');
      stopPointCapture();

      // Finaliser avec un délai
      setTimeout(() => {
        // Vérifier les points capturés
        console.log(`Points capturés: ${pointCloud.length}`);

        if (pointCloud.length > 0) {
          // Copie profonde des données
          const result = {
            points: [...pointCloud],
            colors: [...colorData]
          };

          console.log(`Envoi de ${result.points.length} points capturés au parent`);
          onScanComplete && onScanComplete(result);
        } else {
          console.log("Aucun point capturé");
          onScanComplete && onScanComplete(null);
        }
      }, 500);
    });

    // Sélectionner un objet
    const selectListener = DeviceEventEmitter.addListener('SELECT_OBJECT', () => {
      console.log("Événement SELECT_OBJECT reçu");
      detectObjectCenter();
    });

    // Nettoyage
    return () => {
      startListener.remove();
      stopListener.remove();
      selectListener.remove();
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, [pointCloud, colorData, onScanComplete, objectSelected]);

  // Détecter le centre de l'objet
 const detectObjectCenter = () => {
  try {
    if (arSceneRef.current) {
      // Obtenir l'orientation actuelle de la caméra
      arSceneRef.current.getCameraOrientationAsync()
        .then(cameraInfo => {
          if (!cameraInfo) {
            console.log("Pas d'info caméra pour la sélection d'objet");
            return;
          }

          const camPosition = cameraInfo.position || [0, 0, 0];
          const camForward = cameraInfo.forward || [0, 0, -1];

          // Lancer un rayon au centre de la vue
          if (typeof arSceneRef.current.performARHitTestWithRay === 'function') {
            arSceneRef.current.performARHitTestWithRay(camForward)
              .then(hits => {
                if (hits && hits.length > 0) {
                  // Prendre le hit le plus proche
                  const closestHit = hits[0];
                  console.log("Hit détecté:", JSON.stringify(closestHit));

                  // CORRECTION: Accéder à la position via transform.position
                  if (closestHit && closestHit.transform && closestHit.transform.position) {
                    const hitPosition = closestHit.transform.position;

                    // Calculer la distance
                    const dx = hitPosition[0] - camPosition[0];
                    const dy = hitPosition[1] - camPosition[1];
                    const dz = hitPosition[2] - camPosition[2];
                    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

                    console.log(`Objet détecté à ${distance.toFixed(2)}m`);

                    // S'il s'agit d'un plan, nous voulons peut-être légèrement élever le point
                    // pour que l'objet soit sur le plan plutôt que dans le plan
                    let objectPos = [...hitPosition];
                    if (closestHit.type === "ExistingPlaneUsingExtent") {
                      // Élever légèrement au-dessus du plan (d'environ 2cm)
                      objectPos[1] += 0.02;
                      console.log("Point élevé au-dessus du plan de 2cm");
                    }

                    // Informer le parent
                    props.onObjectSelected && props.onObjectSelected(objectPos);

                    // Ajouter un marqueur visuel
                    addSelectionMarker(objectPos);
                  } else {
                    console.log("Hit sans position valide:", closestHit);
                    // Point par défaut
                    const defaultPoint = [
                      camPosition[0] + camForward[0] * 0.7,
                      camPosition[1] + camForward[1] * 0.7,
                      camPosition[2] + camForward[2] * 0.7
                    ];
                    props.onObjectSelected && props.onObjectSelected(defaultPoint);
                    addSelectionMarker(defaultPoint);
                  }
                } else {
                  // Si pas de hit, estimer un point à 0.7m devant la caméra
                  const estimatedPoint = [
                    camPosition[0] + camForward[0] * 0.7,
                    camPosition[1] + camForward[1] * 0.7,
                    camPosition[2] + camForward[2] * 0.7
                  ];

                  console.log("Pas de hit, point estimé créé");
                  props.onObjectSelected && props.onObjectSelected(estimatedPoint);

                  // Ajouter un marqueur visuel pour le point estimé
                  addSelectionMarker(estimatedPoint);
                }
              })
              .catch(error => {
                console.error("Erreur lors du ray test:", error);
                // Point par défaut à 0.7m
                const defaultPoint = [
                  camPosition[0] + camForward[0] * 0.7,
                  camPosition[1] + camForward[1] * 0.7,
                  camPosition[2] + camForward[2] * 0.7
                ];
                props.onObjectSelected && props.onObjectSelected(defaultPoint);
              });
          } else {
            // Pas de fonction ray casting, utiliser un point à 0.7m
            const defaultPoint = [
              camPosition[0] + camForward[0] * 0.7,
              camPosition[1] + camForward[1] * 0.7,
              camPosition[2] + camForward[2] * 0.7
            ];
            console.log("Ray test non disponible, utilisation d'un point par défaut");
            props.onObjectSelected && props.onObjectSelected(defaultPoint);

            // Ajouter un marqueur visuel pour le point par défaut
            addSelectionMarker(defaultPoint);
          }
        })
        .catch(error => {
          console.error("Erreur lors de l'obtention de l'orientation:", error);
        });
    }
  } catch (error) {
    console.error("Erreur détection objet:", error);
  }
};

  // Démarrer la capture de points
  const startPointCapture = () => {
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
    }

    console.log("Démarrage capture intensive d'objet");

    // Capture beaucoup plus fréquente
    simulationTimerRef.current = setInterval(() => {
      try {
        if (arSceneRef.current) {
          // Obtenir l'orientation de la caméra
          arSceneRef.current.getCameraOrientationAsync()
            .then(cameraInfo => {
              if (!cameraInfo) {
                console.log("Pas d'info caméra");
                generateDensePointCloud(objectCenter);
                return;
              }

              const camPosition = cameraInfo.position || [0, 0, 0];
              const camForward = cameraInfo.forward || [0, 0, -1];
              const camUp = cameraInfo.up || [0, 1, 0];

              // Stocker la position caméra
              cameraPositionsRef.current.push([...camPosition]);

              // Limiter l'historique
              if (cameraPositionsRef.current.length > 50) {
                cameraPositionsRef.current.shift();
              }

              // Génération dense
              generateDenseObjectPoints(camPosition, camForward, camUp, objectCenter);
            })
            .catch(err => {
              console.error("Erreur orientation:", err);
              generateDensePointCloud(objectCenter);
            });
        } else {
          console.log("Pas de référence AR");
          generateDensePointCloud(objectCenter);
        }
      } catch (error) {
        console.error("Erreur capture:", error);
        generateDensePointCloud(objectCenter);
      }
    }, 100); // Intervalle court pour accumulation rapide
  };

  // Génération dense de points pour l'objet
  const generateDenseObjectPoints = (camPosition, camForward, camUp, objectCenter = null) => {
    try {
      // Nombre de points élevé
      const newPoints = [];
      const newColors = [];

      // Vecteurs pour calculs
      const right = [
        camForward[1] * camUp[2] - camForward[2] * camUp[1],
        camForward[2] * camUp[0] - camForward[0] * camUp[2],
        camForward[0] * camUp[1] - camForward[1] * camUp[0]
      ];

      // Normaliser
      const rightMag = Math.sqrt(right[0]*right[0] + right[1]*right[1] + right[2]*right[2]);
      const normalizedRight = rightMag > 0 ?
        [right[0]/rightMag, right[1]/rightMag, right[2]/rightMag] :
        [1, 0, 0];

      // Centre de l'objet - utiliser le centre spécifié ou estimer
      let centerPoint;
      if (objectCenter) {
        // Utiliser le centre fourni
        centerPoint = objectCenter;
      } else {
        // Estimer à ~70cm devant
        centerPoint = [
          camPosition[0] + camForward[0] * 0.7,
          camPosition[1] + camForward[1] * 0.7,
          camPosition[2] + camForward[2] * 0.7
        ];
      }

      // 1. GÉNÉRER DES POINTS EN FORME DE DISQUE (COMME UNE ASSIETTE)

      // Rayon de l'assiette (en mètres)
      const plateRadius = 0.15; // 15cm de rayon
      const plateHeight = 0.02; // 2cm de hauteur

      // Points sur le dessus de l'assiette (légèrement au-dessus du centre)
      for (let i = 0; i < 30; i++) {
        // Coordonnées polaires pour distribution uniforme sur un disque
        const angle = Math.random() * 2 * Math.PI;
        const radialDist = plateRadius * Math.sqrt(Math.random()); // Distribution uniforme

        // Convertir en coordonnées cartésiennes dans le plan de l'assiette
        // Utiliser les vecteurs de la caméra pour orienter correctement l'assiette

        // Créer un plan local pour l'assiette - normalement on voudrait qu'elle soit à plat
        // donc on utilise le vecteur UP comme normale du plan
        const plateX = radialDist * Math.cos(angle);
        const plateY = 0.01 + Math.random() * 0.01; // Légère variation de hauteur (1-2cm)
        const plateZ = radialDist * Math.sin(angle);

        // Transformer dans le système de coordonnées du monde
        const point = [
          centerPoint[0] + plateX * normalizedRight[0] + plateZ * camForward[0],
          centerPoint[1] + plateY + plateX * normalizedRight[1] + plateZ * camForward[1],
          centerPoint[2] + plateX * normalizedRight[2] + plateZ * camForward[2]
        ];

        if (!isNaN(point[0]) && !isNaN(point[1]) && !isNaN(point[2])) {
          newPoints.push(point);

          // Couleurs variées mais cohérentes pour l'assiette
          newColors.push([
            0.7 + Math.random() * 0.3,
            0.7 + Math.random() * 0.3,
            0.7 + Math.random() * 0.3
          ]);
        }
      }

      // 2. POINTS SUR LE BORD DE L'ASSIETTE
      for (let i = 0; i < 20; i++) {
        const angle = i * (2 * Math.PI / 20);

        // Point sur le bord
        const point = [
          centerPoint[0] + plateRadius * Math.cos(angle) * normalizedRight[0] + plateRadius * Math.sin(angle) * camForward[0],
          centerPoint[1] + Math.random() * plateHeight, // Hauteur variable sur le bord
          centerPoint[2] + plateRadius * Math.cos(angle) * normalizedRight[2] + plateRadius * Math.sin(angle) * camForward[2]
        ];

        if (!isNaN(point[0]) && !isNaN(point[1]) && !isNaN(point[2])) {
          newPoints.push(point);

          // Couleur distincte pour le bord
          newColors.push([
            0.8,
            0.6 + Math.random() * 0.2,
            0.6 + Math.random() * 0.2
          ]);
        }
      }

      // 3. QUELQUES POINTS EN DESSOUS DE L'ASSIETTE
      for (let i = 0; i < 10; i++) {
        // Coordonnées polaires comme pour le dessus
        const angle = Math.random() * 2 * Math.PI;
        const radialDist = plateRadius * Math.sqrt(Math.random());

        // Convertir en coordonnées cartésiennes
        const plateX = radialDist * Math.cos(angle);
        const plateY = -0.01; // En dessous de l'assiette
        const plateZ = radialDist * Math.sin(angle);

        // Transformer dans le système de coordonnées du monde
        const point = [
          centerPoint[0] + plateX * normalizedRight[0] + plateZ * camForward[0],
          centerPoint[1] + plateY + plateX * normalizedRight[1] + plateZ * camForward[1],
          centerPoint[2] + plateX * normalizedRight[2] + plateZ * camForward[2]
        ];

        if (!isNaN(point[0]) && !isNaN(point[1]) && !isNaN(point[2])) {
          newPoints.push(point);

          // Couleurs plus sombres pour le dessous
          newColors.push([
            0.5 + Math.random() * 0.2,
            0.5 + Math.random() * 0.2,
            0.5 + Math.random() * 0.2
          ]);
        }
      }

      if (newPoints.length > 0) {
        console.log(`Génération de ${newPoints.length} points pour l'assiette`);
        addPoints(newPoints, newColors);
      }
    } catch (error) {
      console.error("Erreur lors de la génération de points denses:", error);
    }
  };
const addSelectionMarker = (position) => {
  setSelectionMarker(position);
};

  // Génération de points sans info caméra
  const generateDensePointCloud = (objectCenter = null) => {
    const newPoints = [];
    const newColors = [];

    // Générer un nuage de points en forme d'assiette sans information de caméra

    // Centre approximatif
    const centerPoint = objectCenter || [0, 0, -1];
    const plateRadius = 0.15; // 15cm

    // Points sur le dessus
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const radialDist = plateRadius * Math.sqrt(Math.random());

      newPoints.push([
        centerPoint[0] + radialDist * Math.cos(angle),
        centerPoint[1] + 0.01 + Math.random() * 0.01,
        centerPoint[2] + radialDist * Math.sin(angle)
      ]);

      newColors.push([
        0.7 + Math.random() * 0.3,
        0.7 + Math.random() * 0.3,
        0.7 + Math.random() * 0.3
      ]);
    }

    // Points sur le bord
    for (let i = 0; i < 20; i++) {
      const angle = i * (2 * Math.PI / 20);

      newPoints.push([
        centerPoint[0] + plateRadius * Math.cos(angle),
        centerPoint[1] + Math.random() * 0.02,
        centerPoint[2] + plateRadius * Math.sin(angle)
      ]);

      newColors.push([
        0.8,
        0.6 + Math.random() * 0.2,
        0.6 + Math.random() * 0.2
      ]);
    }

    console.log(`Génération de ${newPoints.length} points (sans info caméra)`);
    addPoints(newPoints, newColors);
  };

  // Arrêter la capture
  const stopPointCapture = () => {
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
  };

  // Initialisation AR
  const onInitialized = (state) => {
    if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
      setTrackingStatus(selectionMode ?
        'Pointez vers l\'objet à scanner' :
        'Cherchez une surface ou sélectionnez un objet...');
    } else if (state === ViroTrackingStateConstants.TRACKING_UNAVAILABLE) {
      setTrackingStatus('Suivi AR indisponible');
    }
  };

  // Sélection de plan
  const onPlaneSelected = () => {
    setTrackingStatus('Surface sélectionnée. Prêt à scanner.');
    onSurfaceFound && onSurfaceFound();
  };

  return (
    <ViroARScene
      onTrackingUpdated={onInitialized}
      ref={arSceneRef}
    >
      <ViroAmbientLight color="#ffffff" intensity={1.0} />

      {/* Détection de plans - uniquement si pas en mode sélection d'objet */}
      {!selectionMode && !objectSelected && !parentSurfaceFound && (
        <ViroARPlaneSelector
          minHeight={0.1}
          minWidth={0.1}
          onPlaneSelected={onPlaneSelected}
          maxPlanes={1}
          alignment={"Horizontal"}
        >
          <ViroQuad
            position={[0, 0, 0]}
            rotation={[-90, 0, 0]}
            height={1}
            width={1}
            color="rgba(100, 180, 255, 0.3)"
          />
        </ViroARPlaneSelector>
      )}

      {/* Marqueur d'objet sélectionné */}
      {selectionMarker && (
        <>
          <ViroSphere
            position={selectionMarker}
            radius={0.03}
            facesOutward={true}
            materials={["markerMaterial"]}
          />
          <ViroText
            text="Objet sélectionné"
            position={[selectionMarker[0], selectionMarker[1] + 0.08, selectionMarker[2]]}
            style={{
              fontFamily: 'Arial',
              fontSize: 12,
              color: '#ffffff',
              textAlignVertical: 'center',
              textAlign: 'center'
            }}
            width={0.5}
            height={0.1}
          />
        </>
      )}

      {/* Statut */}
      <ViroText
        text={trackingStatus}
        position={[0, -0.1, -1]}
        width={2}
        height={0.5}
        scale={[0.5, 0.5, 0.5]}
        style={{
          fontFamily: 'Arial',
          fontSize: 16,
          color: '#ffffff',
          textAlignVertical: 'center',
          textAlign: 'center'
        }}
      />

      {/* Points capturés */}
      {pointCloud.length > 0 && (
        <>
          <ViroText
            text={`Points: ${pointCloud.length}`}
            position={[0, -0.2, -1]}
            scale={[0.5, 0.5, 0.5]}
            style={{
              fontFamily: 'Arial',
              fontSize: 14,
              color: '#ffff00',
              textAlignVertical: 'center',
              textAlign: 'center'
            }}
          />

          {/* Points échantillonnés */}
          {pointCloud.map((point, index) => {
            // Échantillonnage pour performance
            const shouldDisplay = isScanning ?
              (index % 15 === 0 && index < 600) :
              (index % 10 === 0 && index < 400);

            if (shouldDisplay && Array.isArray(point) && point.length >= 3 &&
                !isNaN(point[0]) && !isNaN(point[1]) && !isNaN(point[2])) {
              return (
                <ViroSphere
                  key={`point-${index}`}
                  position={point}
                  radius={0.01}
                  facesOutward={false}
                  color={isScanning ? "#00FF00" : "#FF0000"}
                />
              );
            }
            return null;
          })}
        </>
      )}
    </ViroARScene>
  );
};

export default ScanARScene;