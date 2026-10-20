import React, { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

// Fade + slide-up entrance. `delay` lets lists stagger their items.
export default function FadeInView({ delay = 0, distance = 16, duration = 420, style, children }) {
  const progress = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
