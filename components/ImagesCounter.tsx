import React, { useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Octicons } from "@expo/vector-icons";

// Constantes pour les animations
const ANIMATION_CONFIG = {
  SPRING: { mass: 0.3, damping: 15 },
  TIMING: { duration: 200 }
};

export const AnimatedCounter = memo(({ current, total = 120, size = 20 }) => {
  // Valeurs pour l'animation
  const yPosition = useSharedValue(0);
  const opacity = useSharedValue(1);
  const prevValueRef = useSharedValue(current);

  // Animation handler
  const animateTransition = useCallback(() => {
    // Sortie du chiffre actuel (vers le haut)
    yPosition.value = withSpring(-30, ANIMATION_CONFIG.SPRING);
    opacity.value = withTiming(0, ANIMATION_CONFIG.TIMING);

    // Programmer l'animation d'entrée
    setTimeout(() => {
      yPosition.value = 30; // Positionner sous la zone visible
      opacity.value = 0;    // Invisible au début

      // Actualiser la valeur de référence
      prevValueRef.value = current;

      // Animer l'entrée du nouveau chiffre
      requestAnimationFrame(() => {
        yPosition.value = withSpring(0, ANIMATION_CONFIG.SPRING);
        opacity.value = withTiming(1, ANIMATION_CONFIG.TIMING);
      });
    }, 100);
  }, [current, yPosition, opacity, prevValueRef]);

  // Déclencher l'animation lors du changement de valeur
  useEffect(() => {
    if (current !== prevValueRef.value) {
      animateTransition();
    }
  }, [current, animateTransition, prevValueRef.value]);

  // Styles animés
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: yPosition.value }],
    opacity: opacity.value,
  }));

  // Styles pré-calculés pour éviter les recréations
  const containerStyle = [styles.container, { width: size * 6 }];
  const counterStyle = [styles.counterContainer, { height: size * 2 }];
  const numberStyle = [styles.number, animatedStyle, { fontSize: size, color: "white" }];
  const staticNumberStyle = [styles.number, { fontSize: size, color: "white" }];
  const separatorStyle = { fontSize: size - 4, color: "white" };

  return (
    <View style={containerStyle}>
      <View style={counterStyle}>
        <Animated.Text style={numberStyle}>
          {prevValueRef.value}
        </Animated.Text>
        <Text style={separatorStyle}>/</Text>
        <Text style={staticNumberStyle}>{total}</Text>
      </View>
      <Octicons name="image" color="white" size={size} />
    </View>
  );
});

// Styles optimisés avec memo
const styles = StyleSheet.create({
  container: {
    columnGap: 5,
    justifyContent: "center",
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterContainer: {
    color: "white",
    columnGap: 2,
    flexDirection: 'row',
    justifyContent: "center",
    alignItems: 'center',
    overflow: 'hidden',
  },
  number: {
    letterSpacing: -0.5,
    fontWeight: 'bold',
  },
});