import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage for credentials (access and refresh tokens). Same signature as
// AsyncStorage: getItem / setItem / removeItem, all async.
//
// - Native (iOS/Android): expo-secure-store (Keychain / Keystore).
// - Web: SecureStore does not exist there, so this falls back to AsyncStorage
//   (localStorage). That is readable by any script on the page; web should
//   move to an httpOnly, SameSite cookie issued by the backend later.
//
// Failures never crash the caller: a SecureStore error degrades to
// AsyncStorage. Values older than this wrapper (still in AsyncStorage) are
// migrated lazily on first read.

const isNative = Platform.OS !== 'web';

let SecureStore = null;
if (isNative) {
  try {
    // Required lazily so web bundles never touch the native module.
    SecureStore = require('expo-secure-store');
  } catch {
    SecureStore = null;
  }
}

export async function getItem(key) {
  if (SecureStore) {
    try {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue !== null && secureValue !== undefined) return secureValue;
    } catch {
      // fall through to AsyncStorage
    }
    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue !== null && legacyValue !== undefined) {
      // Lazy migration: copy into SecureStore, then drop the plaintext copy.
      try {
        await SecureStore.setItemAsync(key, legacyValue);
        await AsyncStorage.removeItem(key);
      } catch {
        // keep the AsyncStorage copy when SecureStore is unavailable
      }
    }
    return legacyValue;
  }
  return AsyncStorage.getItem(key);
}

export async function setItem(key, value) {
  if (SecureStore) {
    try {
      await SecureStore.setItemAsync(key, value);
      // Make sure no stale plaintext copy survives.
      await AsyncStorage.removeItem(key).catch(() => {});
      return;
    } catch {
      // fall through to AsyncStorage
    }
  }
  await AsyncStorage.setItem(key, value);
}

export async function removeItem(key) {
  if (SecureStore) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignored: still clear the fallback store below
    }
  }
  await AsyncStorage.removeItem(key);
}

export default { getItem, setItem, removeItem };
