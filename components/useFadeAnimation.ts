import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing
} from 'react-native-reanimated';

export const useFadeAnimation = (visible, options = {}) => {
  // Options par défaut
  const {
    duration = 300,
    initialOpacity = 0,
    targetOpacity = 1,
    easing = Easing.bezier(0.25, 0.1, 0.25, 1)
  } = options;

  // Valeur d'opacité partagée
  const opacity = useSharedValue(initialOpacity);

  // Réagit aux changements de l'état visible
  useEffect(() => {
    opacity.value = withTiming(
      visible ? targetOpacity : 0,
      {
        duration,
        easing
      }
    );
  }, [visible, duration, targetOpacity, easing]);

  // Style animé à appliquer au composant
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return animatedStyle;
};