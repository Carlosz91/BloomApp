import Constants from 'expo-constants';

// Centralized API base URL.
//
// Resolution order:
// 1. EXPO_PUBLIC_API_URL — static override inlined when Metro bundles the app
//    (set by Docker/production builds).
// 2. During development (Expo Go / dev build), derive the host from the Metro
//    dev server address (Constants.expoConfig.hostUri, e.g. "192.168.0.2:8081").
//    The API then follows the machine running the bundler, so the LAN IP of
//    the PC never needs to be hardcoded. hostUri is only present in dev.
// 3. Fallback to localhost — works on web and simulators.
function resolveBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  const host = Constants.expoConfig?.hostUri;
  if (host) {
    return `http://${host.split(':')[0]}:3000`;
  }
  return 'http://localhost:3000';
}

export const API_BASE_URL = resolveBaseUrl();
