// Centralized API base URL.
// EXPO_PUBLIC_API_URL is inlined into the JS bundle when Metro bundles the app
// (it comes from the environment where `expo start` runs, e.g. the Docker
// container). The value must be reachable FROM THE DEVICE: on a physical phone
// it must be the PC's LAN IP, because localhost would resolve to the phone itself.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.13:3000';
