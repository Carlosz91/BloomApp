import * as React from 'react';
import { Text, View, StyleSheet } from 'react-native';

export default function TestScreen() {
  return (
    <View style={styles.center}>
      <Text>Ruta de TEST - Si ves esto, Expo Router funciona</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});