---
name: styling
description: Use whenever you add or change colors, classNames, styles, themes, map layer colors, or UI that should match the mockups in docs/design/mockups. Defines semantic tokens, the Tailwind-only palette rule, and how map styles get colors.
---

# Styling

## Rules
1. **Semantic tokens only.** Components use classes like `bg-surface`, `text-text-muted`,
   `border-border`, `bg-accent text-on-accent`. Never hex values, never raw palette classes
   (`bg-stone-900`). Lint enforces both outside `src/theme/`.
2. **Tailwind palette only.** New colors are added to `palette` in `src/theme/tokens.ts`
   using the exact Tailwind v3 hex value and name. No custom colors.
3. **Adding a token:** add the name to `src/theme/semantic-token-names.json`, add a value
   to every theme in `tokens.ts` (`'stone-800'` or `{ color, alpha }`), run `npx jest src/theme`.
4. **Map layers** cannot use classNames. Use `mapColors(theme)` (or `useTheme().colors`)
   for Mapbox style values, so map and UI share one source.
5. **Themes** are data: a new theme (day, night/red-light) is a new entry in `themes`.
6. **Match the mockups** in `docs/design/mockups/`: dark chrome, amber accent, uppercase
   tracked labels, monospace readouts and map labels.
7. **No opacity modifiers on tokens.** Token colors are CSS variables, so Tailwind opacity modifiers (`bg-accent/50`) don't work — add a translucent token instead. The `neutral` token (affiliation green) replaces Tailwind's `neutral-*` scale in classNames.

## Token reference (dark)
| Token | Use |
|-------|-----|
| `surface` | panels and sheets |
| `surface-chrome` | toolbar, map buttons, readout card (translucent) |
| `surface-input` | text fields, segmented controls |
| `surface-raised` | secondary buttons |
| `border` | borders, dividers |
| `text` / `text-muted` | primary / label text |
| `accent` / `accent-subtle` / `on-accent` | primary action, active tool, focus, draft |
| `success` / `danger` | valid input / destructive, invalid |
| `friendly` / `hostile` / `neutral` / `unknown` | affiliation colors (symbols too) |
| `self` | own-position icon |
| `map-label-bg` / `map-label-text` | map label chips |
