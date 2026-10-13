// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const GEO_LIBS_REGEX = '^(mgrs|geographiclib-geodesic|geomagnetism)(/.*)?$';
const WATERMELON = ['@nozbe/watermelondb', '@nozbe/watermelondb/*'];
const MAPBOX = ['@rnmapbox/maps', '@rnmapbox/maps/*'];
const REACT = ['react', 'react/*', 'react-native', 'react-native/*'];
const UPPER_LAYERS = [
  '@/features/*',
  '@/stores/*',
  '@/components/*',
  '@/app/*',
  // Relative imports from src/lib into upper layers.
  '**/features/**',
  '**/stores/**',
  '**/components/**',
  '**/app/**',
];

const msg = {
  geo: 'Geodesy libraries are wrapped by src/lib/geo. Import from @/lib/geo/... instead.',
  db: 'Only src/lib/db and feature repository.ts/commands.ts may use WatermelonDB.',
  mapbox: 'Only src/features/map may import @rnmapbox/maps.',
  upper: 'src/lib must not depend on features, stores, components or routes.',
  react: 'src/lib/geo must stay framework-free (no react / react-native).',
};

/** One no-restricted-imports rule per zone; flat config replaces (not merges) rule options. */
function restrict({ geo = true, db = true, mapbox = true, upper = false, react = false }) {
  const patterns = [];
  if (geo) patterns.push({ regex: GEO_LIBS_REGEX, message: msg.geo });
  if (db) patterns.push({ group: WATERMELON, message: msg.db });
  if (mapbox) patterns.push({ group: MAPBOX, message: msg.mapbox });
  if (upper) patterns.push({ group: UPPER_LAYERS, message: msg.upper });
  if (react) patterns.push({ group: REACT, message: msg.react });
  return { 'no-restricted-imports': ['error', { patterns }] };
}

const NO_HEX = {
  selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
  message: 'No hex colors outside src/theme. Use a semantic token (className or useTheme().colors).',
};
const NO_PALETTE = {
  selector:
    'Literal[value=/\\b(?:bg|text|border|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}\\b/]',
  message: 'No raw Tailwind palette classes. Use semantic classes (bg-surface, text-accent, ...).',
};
const NO_RAW_TEXT_INPUT = {
  selector: "JSXOpeningElement[name.name='TextInput']",
  message: 'Use TextField from @/components/ui/TextField so every text input looks and aligns the same.',
};

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
    files: ['src/features/*/repository.ts', 'src/features/*/commands.ts', 'src/features/*/*.test.{ts,tsx}'],
    rules: restrict({ db: false }),
  },
  // One no-restricted-syntax list per zone (flat config replaces rule options, it does not merge).
  { files: ['src/**/*.{ts,tsx}'], ignores: ['src/theme/**'], rules: { 'no-restricted-syntax': ['error', NO_HEX, NO_PALETTE, NO_RAW_TEXT_INPUT] } },
  { files: ['src/components/ui/TextField.tsx'], rules: { 'no-restricted-syntax': ['error', NO_HEX, NO_PALETTE] } },
]);
