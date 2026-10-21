import React, { useState } from 'react';
import { Animated, Pressable } from 'react-native';

// Pressable that springs down on touch and bounces back on release.
export default function PressableScale({ onPress, style, containerStyle, scaleTo = 0.96, children }) {
  const scale = useState(() => new Animated.Value(1))[0];

  const animate = (toValue) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  return (
    <Pressable style={containerStyle} onPress={onPress} onPressIn={() => animate(scaleTo)} onPressOut={() => animate(1)}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
