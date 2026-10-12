/** @type {import('tailwindcss').Config} */
const semanticTokens = require('./src/theme/semantic-token-names.json');

module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Values come from CSS variables set by ThemeProvider (src/theme/tokens.ts).
      colors: Object.fromEntries(semanticTokens.map((name) => [name, `var(--${name})`])),
      fontFamily: {
        mono: ['JetBrainsMono_500Medium'],
        'mono-bold': ['JetBrainsMono_700Bold'],
      },
    },
  },
  plugins: [],
};
