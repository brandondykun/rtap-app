// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const GEO_LIBS = ['mgrs', 'geographiclib-geodesic', 'geomagnetism'];
const WATERMELON = ['@nozbe/watermelondb', '@nozbe/watermelondb/*'];
const MAPBOX = ['@rnmapbox/maps', '@rnmapbox/maps/*'];
const UPPER_LAYERS = ['@/features/*', '@/stores/*', '@/components/*', '@/app/*'];

const msg = {
  geo: 'Geodesy libraries are wrapped by src/lib/geo. Import from @/lib/geo/... instead.',
  db: 'Only src/lib/db and feature repository.ts/commands.ts may use WatermelonDB.',
  mapbox: 'Only src/features/map may import @rnmapbox/maps.',
  upper: 'src/lib must not depend on features, stores, components or routes.',
  react: 'src/lib/geo must stay framework-free (no react / react-native).',
};

/** One no-restricted-imports rule per zone; flat config replaces (not merges) rule options. */
function restrict({ geo = true, db = true, mapbox = true, upper = false, react = false }) {
  const paths = [];
  const patterns = [];
  if (geo) paths.push(...GEO_LIBS.map((name) => ({ name, message: msg.geo })));
  if (db) patterns.push({ group: WATERMELON, message: msg.db });
  if (mapbox) patterns.push({ group: MAPBOX, message: msg.mapbox });
  if (upper) patterns.push({ group: UPPER_LAYERS, message: msg.upper });
  if (react) paths.push({ name: 'react', message: msg.react }, { name: 'react-native', message: msg.react });
  return { 'no-restricted-imports': ['error', { paths, patterns }] };
}

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'scripts/*'] },
  // Order matters: later zones override earlier ones for files they match.
  { files: ['src/**/*.{ts,tsx}'], rules: restrict({}) },
  { files: ['src/lib/**/*.{ts,tsx}'], rules: restrict({ upper: true }) },
  { files: ['src/lib/geo/**/*.{ts,tsx}'], rules: restrict({ geo: false, upper: true, react: true }) },
  { files: ['src/lib/db/**/*.{ts,tsx}'], rules: restrict({ db: false, upper: true }) },
  { files: ['src/features/map/**/*.{ts,tsx}'], rules: restrict({ mapbox: false }) },
  {
    files: ['src/features/*/repository.ts', 'src/features/*/commands.ts', 'src/features/*/*.test.ts'],
    rules: restrict({ db: false }),
  },
]);
