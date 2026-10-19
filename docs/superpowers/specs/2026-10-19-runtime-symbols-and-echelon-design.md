# Runtime symbols (Skia) and unit echelon

## Goal

Any MIL-STD-2525C SIDC renders on the map and in menus without a rebuild, by drawing symbols on the
device with milsymbol + Skia instead of pre-built PNGs. First use of that: units get an **Echelon**
(Team/Crew up to Division), default Unspecified.

Supersedes the MVP note in the architecture spec §8.2 ("build-time Node script … Later: runtime
rasterization (Skia)"): this is the "later". `getSymbolImage(sidc)` stays the one entry point.

## Rendering pipeline (`src/features/symbology/render/`)

- **`symbolSvg(sidc, colors)`**: pure TypeScript, moved from `scripts/build-symbols.ts`, with identical
  output to today:
  - Units: `new ms.Symbol(sidc, { size: 30, fillColor: <affiliation fill>, strokeWidth: 6 })`.
    Affiliation fills: friend `friendly`, hostile `hostile`, neutral `neutral`, unknown `unknown`.
  - Control points: point color `friendly`, halo `point-symbol-halo`, outline width 2, strokes ×1.8,
    padded so the graphic's anchor is the image center (`centeredOnAnchor`).
  - Landing zone: the hand-drawn white-on-halo circle with "LZ" text.
  - `symbolSvg(sidc, colors, { trimmed: true })` is not done in SVG; trimming happens on pixels (below).
- **`rasterizeSymbol(sidc, scale, { trimmed })`**: Skia parses the SVG (`Skia.SVG.MakeFromString`), draws
  it on an offscreen surface at `scale` (device pixel ratio, 1–3), and encodes PNG. `trimmed` crops to the
  visible (non-transparent) pixels, as the build script's `trimmed` did, for menus and lists.
  If Skia's SVG text support cannot draw the LZ label, the LZ is drawn with Skia's own text call.
- **Disk cache**: `<cacheDirectory>/symbols/v<SYMBOL_RENDER_VERSION>/<sidc>@<scale>[-trim].png`.
  `SYMBOL_RENDER_VERSION` is a constant bumped whenever drawing code or colors change; older version
  folders are deleted on first use of a new version.
- **`getSymbolImage(sidc, { trimmed? })`**: returns a file URI for the device scale; reads the cache, or
  renders and writes it. Concurrent requests for the same key share one render. Never throws: a failure
  is logged once per key and resolves to `null` (callers fall back to nothing / a placeholder).

## Map

- `MAP_IMAGES` keeps only the fixed app images (self, label chips, draft ring, line images, reticle).
- A `useSymbolImages(missionId)` hook collects the distinct SIDCs of the mission's items (plus any
  SIDC in an open draft), resolves them with `getSymbolImage`, and returns a stable
  `Record<sidc, { uri }>` merged into `<Images>`. New SIDCs (a new unit, an echelon change) are added
  as they appear; the record keeps identity when nothing changed (performance rule: stable references).
- `MapView`'s image-missing callback (`onImageMissing` / `<Images onImageMissing>`) requests the SIDC
  as a safety net, so a symbol is blank for at most one render on first use.
- Opening a mission waits for nothing: the map shows immediately; symbols appear as they resolve
  (from cache: effectively immediate).

## Menus and lists

- `symbolThumbnail(sidc)` becomes a hook `useSymbolThumbnail(sidc)` returning a `{ uri }` (trimmed) or
  `null` while it renders. Used wherever `SYMBOL_IMAGES`/`symbolThumbnail` are used today (unit form,
  point form, Layers, add menus).

## Removed

- `scripts/build-symbols.ts`, the `build:symbols` npm script, `@resvg/resvg-js` (dev dependency, if
  nothing else uses it), `src/features/symbology/symbol-images.generated.ts`, `assets/symbols/`.

## Echelon

- 2525C positions 11–12. `-` + echelon letter; Unspecified is `--`:

  | Echelon | Code |
  |---|---|
  | Unspecified | `--` |
  | Team/Crew | `-A` |
  | Squad | `-B` |
  | Section | `-C` |
  | Platoon/Detachment | `-D` |
  | Company/Battery/Troop | `-E` |
  | Battalion/Squadron | `-F` |
  | Regiment/Group | `-G` |
  | Brigade | `-H` |
  | Division | `-I` |

- `presets.ts`: `type Echelon`, `ECHELONS` (id, label, code) in the order above;
  `composeSidc(affiliation, unitType, echelon = 'unspecified')`; `decomposeSidc` returns `echelon`
  (unknown codes in 11–12 read as `unspecified`). Existing stored SIDCs (all `--`) read as Unspecified.
- Draft store: `echelon` beside `affiliation`/`unitType`; set from the item when editing; reset to
  Unspecified for new units, including long-press enemy units and toolbar presets.
- Unit form: an **Echelon** `MenuSelect` below Unit type, labels as in the table ("Platoon",
  "Company", "Battalion" short forms in the list are fine: use the first word before the slash).
- No database change: the echelon lives in the item's SIDC.

## Dependencies

- `npx expo install @shopify/react-native-skia` (new native module: new development build).
- Jest: Skia is mocked (`@shopify/react-native-skia/lib/module/mock` or a local mock); rendering
  quality is verified on a device.

## Testing

- Unit: `symbolSvg` (unit fill per affiliation, echelon marking present for each echelon, point anchor
  centering, LZ), cache (hit, miss, dedupe of concurrent requests, version folder cleanup, failure → null),
  `composeSidc`/`decomposeSidc` with echelons (round trip, unknown code → unspecified, existing `--`).
- Component: `useSymbolImages` (collects mission SIDCs, stable record, adds new SIDCs), image-missing
  request, unit form echelon picker (default Unspecified, edit shows stored echelon, changes the SIDC),
  thumbnails render from the hook.
- Device (manual): symbols look as before; each echelon draws correctly on all four frame shapes;
  first-open delay acceptable; reopen is instant (cache).

## Risks

- Skia SVG coverage of milsymbol output (paths, groups, text): verify in the first task on a device
  build; fall back to Skia-drawn text for the LZ label.
- First open of a mission with many distinct symbols is slower once; later opens hit the cache.
- Skia adds several MB to the app binary.
