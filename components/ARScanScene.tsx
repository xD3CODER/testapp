'use strict';

import React from 'react';
import { ViroARScene, ViroText, ViroTrackingStateConstants } from '@reactvision/react-viro';

// Scène AR minimaliste pour tester la caméra
const ARMinimalScene = (props) => {
  // Gestionnaire minimal de tracking
  const onTrackingUpdated = (state, reason) => {
    if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
      console.log("Tracking normal");
      if (props.sceneNavigator &&
          props.sceneNavigator.viroAppProps &&
          props.sceneNavigator.viroAppProps.onTrackingUpdated) {
        props.sceneNavigator.viroAppProps.onTrackingUpdated('NORMAL');
      }
    }
  };

  return (
    <ViroARScene onTrackingUpdated={onTrackingUpdated}>
      <ViroText
        text="Test AR"
        scale={[0.1, 0.1, 0.1]}
        position={[0, 0, -1]}
        style={{
          fontSize: 20,
          color: 'white',
          textAlignVertical: 'center',
          textAlign: 'center'
        }}
      />
    </ViroARScene>
  );
};

module.exports = ARMinimalScene;