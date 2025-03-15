import { useCallback } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
  withSpring
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
export const useShakeAnimation = (intensity = 10) => {
  const translateX = useSharedValue(0);

  const shake = useCallback(() => {
    // Réinitialiser
    translateX.value = 0;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // Courbe d'accélération/décélération plus vive
    const easing = Easing.bezier(0.2, 1, 0.3, 1);

    // Durées plus courtes (50-70ms) et oscillations légèrement asymétriques
    translateX.value = withSequence(
      withTiming(-intensity, { duration: 50, easing }),
      withTiming(intensity * 0.85, { duration: 50, easing }),
      withTiming(-intensity * 0.7, { duration: 60, easing }),
      withTiming(intensity * 0.5, { duration: 50, easing }),
      withTiming(-intensity * 0.35, { duration: 55, easing }),
      withTiming(intensity * 0.15, { duration: 50, easing }),
      withTiming(-intensity * 0.05, { duration: 40, easing }),
      withTiming(0, { duration: 30, easing })
    );
  }, [intensity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return { shake, animatedStyle };
};