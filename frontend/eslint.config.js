// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // SDK 58 ships some packages (expo-web-browser) where Metro resolves
      // the subpath "exports" map but the legacy import resolver cannot,
      // producing a false "unresolved" error. Keep the stock resolver and
      // ignore exactly those package names.
      'import/no-unresolved': ['error', { ignore: ['expo-web-browser'] }],
    },
  },
]);
