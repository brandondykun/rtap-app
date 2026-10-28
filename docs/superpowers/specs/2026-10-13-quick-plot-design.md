# Quick plot — design

**Status:** approved in conversation 2026-10-13; awaiting written-spec review.
**Builds on:** `2026-10-12-tactical-map-architecture-design.md`, `2026-10-13-measure-design.md`.
**Mockups:** "Portrait / Landscape — Quick Plot grid entry" and "… temp point plotted" (user-supplied,
2026-10-13). Differences agreed in conversation: no custom keypad (the phone keyboard is used),
no `#` glyph, a target icon, and the four-field MGRS input.

## 1. Intent

A fast way to see where a grid is: type it, see it on the map as a temporary point, and only if
wanted save it as a unit or a point. Nothing is written to the mission unless the user saves.

Success: from the map, tap PLOT, type `2537 0537` (zone and square already filled), tap Plot, see
the amber TEMP reticle with "1.58 km · 099°" from the user, then tap **Save point** and land in
Add point at that spot.

## 2. Decisions (from the conversation)

| Topic | Decision |
|---|---|
| Toolbar | **UNIT · POINT · LINE · POLYGON · MEASURE · LAYERS · PLOT**; PLOT icon `target`. |
| Entry | A card centered horizontally under the toolbar (above the keyboard), with the shared four-field `MgrsInput` (zone, square, easting, northing) — no `#`. |
| Keyboard | The phone keyboard (no custom keypad); the keyboard's Go/return on the northing field plots. |
| Prefill | Zone and 100 km square of the crosshair's position; focus starts in Easting. |
| Backspace | In every `MgrsInput` (menus too): backspace in an empty field moves to the previous field. |
| Temporary points | One at a time; a new plot replaces it. |
| Saving | **Save unit** / **Save point** open the existing Add unit / Add point at the temporary point. |

## 3. Behavior

### 3.1 Opening and closing

- Tapping **PLOT** (highlighted while quick plot is active) closes any open menu, stops measuring,
  and shows the entry card with the keyboard up.
- Tapping PLOT again, or **Cancel** on the entry card, closes quick plot (the entry and any temporary point).
  Tapping the map while the entry card is up only puts the keyboard away (changed 2026-10-28: it used to close it).
- Opening any menu (tool, Menu, Settings, Layers, an item) or starting MEASURE closes quick plot.

### 3.2 Entry card — `QuickPlotEntry`

- Position: centered horizontally, directly under the toolbar; portrait: full width minus the
  usual edge margins; landscape: 520 pt wide (never wider than the screen minus margins).
- Content: `MgrsInput` (large mono fields as in the menus) with the prefilled zone and square, a
  clear button (⊗, "Clear grid") that empties all four fields and focuses Zone, a status line, and
  an amber **Plot** button (crosshair glyph, "Plot").
- Status line: `Valid · <distance> @ <bearing> <REF> from you` (via `describeVector` in the user's
  angle unit and north reference), just `Valid` without a GPS fix, the existing error text for an
  invalid grid, nothing while incomplete.
- **Plot** (button or the keyboard's Go on Northing) works only for a valid grid.

### 3.3 Plotting

- The entry card closes, the keyboard is dismissed, `temp` is set to the grid's coordinate, and the
  camera eases to it (with the usual panel-free padding plus the bottom card's height).
- A new plot replaces the previous temporary point.

### 3.4 Temporary point — `QuickPlotLayer` and `QuickPlotCard`

- Map (`QuickPlotLayer`, source `quick-plot`): an amber reticle image (`temp-reticle`, built by
  `build-map-images.ts`), a **TEMP** chip under it (amber chip, dark text — the draft label style),
  and, with a GPS fix, the dashed amber range line from the user to it with the
  `"<distance> · <bearing>"` chip at its midpoint (the existing range styles).
- Card (`QuickPlotCard`, bottom, above the safe area; landscape: centered, ≤ 720 pt wide): a **TEMP**
  badge, the grid (MGRS, mono), and **Discard** (trash), **Save unit** (outlined amber, unit glyph),
  **Save point** (amber, map-marker).
  - Discard clears the temporary point (quick plot ends).
  - Save unit → `openMenu('unit.add', { at: temp })`; Save point → `openMenu('point.add', { at: temp })`.
    Opening the menu ends quick plot; the Add menu's own draft takes over at the same spot.
- The map's own crosshair readout and controls stay as they are.

### 3.5 MGRS input backspace

`MgrsInput` gains backspace hopping: a Backspace key press in an empty Square, Easting or Northing
field focuses the previous field (Zone has no previous). Typing still auto-advances as today.
`MgrsInput` also gains an optional `autoFocus?: 'zone' | 'easting'` (focus that field on mount).
The entry's Clear sets the fields to empty and remounts the input (a React `key`) with
`autoFocus="zone"`.

## 4. Code shape

| Unit | Responsibility |
|---|---|
| `src/stores/quick-plot.ts` | `entryOpen`, `temp: LatLon \| null`; `open()`, `plot(p)`, `close()`. |
| `src/features/quick-plot/QuickPlotEntry.tsx` | The entry card (prefill from the crosshair, status, Plot). |
| `src/features/quick-plot/QuickPlotCard.tsx` | The bottom TEMP card and its three actions. |
| `src/features/quick-plot/quick-plot-features.ts` | Reticle, TEMP chip, range line and chip features. |
| `src/features/map/layers/QuickPlotLayer.tsx` | The map layer. |
| `src/components/menu/MgrsInput.tsx` | Backspace hopping, `autoFocus`. |
| `scripts/build-map-images.ts`, `map-images.ts` | `temp-reticle` image. |
| `Toolbar.tsx`, `MissionMap.tsx` | PLOT tool; toggling; closing on menus/MEASURE/map tap; camera ease. |

## 5. Testing

- `MgrsInput`: backspace in an empty Easting focuses Square (and so on); not when the field has text.
- Store: open / plot / close; plot replaces.
- Features: reticle + TEMP always; range line and chip only with a self position.
- Entry: prefilled zone/square from the crosshair; Plot disabled until valid; status text; Clear.
- Card: Discard clears; Save unit / Save point open the Add menus at the temp point.
- Map screen: PLOT toggles and closes an open menu; plotting closes the entry and shows the card;
  opening Layers or starting MEASURE ends quick plot; a map tap leaves the entry open; Cancel closes it.

## 6. Out of scope

A custom keypad; several temporary points or a plot history; lat/lon entry; saving as a line or
polygon; persisting the temporary point across app restarts.
