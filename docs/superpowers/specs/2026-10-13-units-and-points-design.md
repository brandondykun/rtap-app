# Units and points — design

**Status:** approved in conversation 2026-10-13; awaiting written-spec review.
**Builds on:** `2026-10-12-tactical-map-architecture-design.md` (§5 data, §11 menus, §12 feedback).

## 1. Intent

Today every map symbol is added through **Add Point**, which actually adds a *unit*
(affiliation + unit type). Users also need plain **point locations**: checkpoints, observation
posts, landing zones, start/release points. These have a type, a name, notes and a location, but
no affiliation or unit type.

- Rename today's feature to **Unit** (behavior unchanged).
- Add a separate **Point** feature with its own menus and only the relevant fields.
- Start with 8 point types: must include observation post, checkpoint and landing zone.

Success: a user can place, view, edit, hide, find (Layers) and delete both units and points;
nothing about existing units changes except the name of the feature.

## 2. Decisions (from the conversation)

| Topic | Decision |
|---|---|
| Naming | Toolbar **UNIT · POINT · LAYERS**. Menus "Add unit" / "Unit" / "Edit unit" and "Add point" / "Point" / "Edit point". |
| Point types | 8: Checkpoint, Observation post, Landing zone, Start point, Release point, Rally point, Linkup point, Target reference point. |
| Point color | One color for all point types: white lines with a thin dark halo (readable on every basemap, distinct from colored units). |
| Storage | Approach A: units and points are the same stored item (`kind = 'point'`, a symbol at a location), told apart by symbol code. No schema change, no migration. |
| Long-press | With no Add menu open, starts the most recently used Add (unit or point); Add unit the first time. With an Add menu open it moves that draft, as today. |
| Auto-names | Per point type, per mission: `CP-1`, `OP-1`, `LZ-1`, `SP-1`, `RP-1`, `RLY-1`, `LU-1`, `TRP-1`. |

## 3. Data and symbols

### 3.1 Point types

New module `src/features/symbology/point-types.ts`:

```ts
export type PointType = 'checkpoint' | 'observation-post' | 'landing-zone' | 'start-point'
  | 'release-point' | 'rally-point' | 'linkup-point' | 'target-reference-point';
export const POINT_TYPES: readonly { id: PointType; label: string; prefix: string; sidc: string }[];
export function pointTypeForSidc(sidc: string | null): PointType | null;
export function sidcForPointType(type: PointType): string;
```

| id | label | prefix | stored SIDC (2525C letter, 15 chars) | Symbol source |
|---|---|---|---|---|
| checkpoint | Checkpoint | CP | `GFGPGPPK------X` | milsymbol |
| observation-post | Observation post | OP | `GFGPDPO-------X` | milsymbol |
| landing-zone | Landing zone | LZ | `GFGPAAL-------X` | custom image (§3.3) |
| start-point | Start point | SP | `GFGPGPPS------X` | milsymbol |
| release-point | Release point | RP | `GFGPGPPE------X` | milsymbol |
| rally-point | Rally point | RLY | `GFGPGPPR------X` | milsymbol |
| linkup-point | Linkup point | LU | `GFGPGPPL------X` | milsymbol |
| target-reference-point | Target reference point | TRP | `GFGPDPT-------X` | milsymbol |

All milsymbol codes above were checked with `new ms.Symbol(code).isValid()`. The landing-zone
code is the app's identifier for that type; milsymbol does not draw it, so it never goes
through milsymbol. Nothing has been stored with these codes yet, so any of them can still change
by editing this table alone.

### 3.2 Categories

`src/features/symbology/categories.ts`:

```ts
export type ItemCategory = 'unit' | 'point';
/** 'point' when the SIDC is one of POINT_TYPES; everything else (all existing data) is a unit. */
export function itemCategory(sidc: string | null): ItemCategory;
```

This is the **only** place that decides unit vs point. Menus, the map, Layers, counts and
long-press all call it.

### 3.3 Images

`scripts/build-symbols.ts` also renders the 8 point symbols into `assets/symbols/` at @1x/@2x/@3x
and adds them to `SYMBOL_IMAGES`:

- milsymbol types: rendered at the same `SYMBOL_SIZE` as units with `monoColor` white and a dark
  outline (`outlineColor` from a theme token, `outlineWidth` ≈ 2 px at @1x).
- Landing zone: an SVG drawn by the script in the same style (white circle, centered "LZ"
  text, dark halo), sized to match the other point symbols.
- New theme tokens (`src/theme/tokens.ts`): `point-symbol` (white) and `point-symbol-halo`
  (near-black), used only by the build script.

The map layer, label chips and draft marker need no change: they already draw whatever image
`SYMBOL_IMAGES[sidc]` names.

### 3.4 Naming

`naming.ts` generalizes `nextAutoName` to take a prefix. Units keep `FRD/HOS/NEU/UNK`; points use
their type's prefix. Numbers count per prefix within the mission (`CP-3` after `CP-1`, `CP-2`,
regardless of other types). As with units, changing the type renames an auto-named draft and
never overwrites a name the user typed.

## 4. Menus and interaction

### 4.1 Menu ids

| id | params | title(s) | Notes |
|---|---|---|---|
| `unit.add` | `{ at?: LatLon }` | Add unit | Today's `point.add`, renamed. |
| `unit.edit` | `{ itemId }` | Unit / Edit unit | Today's `point.edit`, renamed. |
| `point.add` | `{ at?: LatLon }` | Add point | New. |
| `point.edit` | `{ itemId }` | Point / Edit point | New; same read-only → Edit → Save/Cancel flow as units. |

`point.edit` opened for a unit (or `unit.edit` for a point), e.g. from a stale link, redirects to
the right menu with the same `itemId`.

### 4.2 Forms

The existing `PointForm` splits into shared sections:

- `LocationSection`: MGRS fields, **Center**, **Map** (with the pick hint), shared by both.
- `NameNotesSection`: Name field and the Notes button/field, shared by both.
- `UnitForm` = Location + Affiliation + Name + Unit type/Notes (today's layout, unchanged).
- `PointForm` (new) = Location + **Type** + Name + Notes.

**Type** is a `MenuSelect` whose options show each type's symbol and label, defaulting to the
type used last (`remembered.pointType`, default Checkpoint). Read-only (locked) disables every
field, as for units. Edit mode adds **Hidden on map** and the double-tap **Delete**.

### 4.3 Draft store

`stores/draft.ts` gains `category: ItemCategory` (set by `startAdd`/`startEdit`), `pointType`
with `setPointType`, `remembered.pointType`, and `lastAddCategory` (most recent Add opened; not
persisted across launches). The draft's SIDC is derived from `category`: affiliation + unit type
for units, `sidcForPointType` for points. `DraftLayer` draws that SIDC, so the draft symbol
follows the type selector immediately.

### 4.4 Commands

`placePoint` and `updateItem` already store any SIDC. No new commands. Validation: a point's SIDC
must be one of `POINT_TYPES`; a unit's must decompose with `decomposeSidc`.

### 4.5 Toolbar and map

- Toolbar: **UNIT** (`account-group-outline`) → toggles `unit.add`; **POINT**
  (`map-marker-outline`) → toggles `point.add`; **LAYERS** unchanged. Highlight = the matching
  menu is on top.
- Tapping a map symbol, or a Layers row, opens `unit.edit` or `point.edit` by `itemCategory`.
- Long-press: if `unit.add`/`point.add`, or the matching edit menu while editing, is open, move
  its draft (today's rule). Otherwise open `lastAddCategory === 'point' ? 'point.add' : 'unit.add'`
  at the press point.
- Map pick (the **Map** button) works the same in both forms.

## 5. Layers panel and missions

- Layers keeps one combined list (symbol, name, coordinate, eye toggle, Show all, search).
- Summary: `"<n> units · <m> points · <k> hidden"` (each part singular/plural; parts with 0 are
  shown as "0 units" so the line keeps its shape).
- Search matches name **or** the type label ("checkpoint" finds every checkpoint; "infantry"
  every infantry unit).
- Mission list row and delete confirmation: `"<n> units · <m> points"` instead of
  `"<n> items"`, using counts by category (`observeMissionCategoryCounts`).

## 6. Docs and skills

- Architecture spec: a "Units and points" subsection under §5 pointing here.
- `.agents/skills/map-item-kinds/SKILL.md`: categories within the point kind, `itemCategory` as
  the single decision point, how to add a point type (table row + image + test).
- `.agents/skills/menus/SKILL.md`: the four item menus and the shared form sections.
- Native gate notes: rows for both Add flows, the type selector, symbol readability on each
  basemap, long-press last-used, Layers summary/search.

## 7. Testing

- `point-types` / `categories`: every type round-trips through its SIDC; `itemCategory` is
  `'unit'` for every unit preset, `null`, unknown codes and existing data; `'point'` for each type.
- Symbols: `SYMBOL_IMAGES` has an entry for every unit preset and every point type.
- Naming: per-prefix counting for points; unit naming unchanged.
- Draft: category, type change re-derives SIDC and renames an auto-name only.
- Menus through `MenuHost`: Add point (type, name, notes, Add → selected read-only Point view),
  Edit point (Edit/Save/Cancel/Hidden/Delete), unit menus under their new ids and titles, and
  wrong-category redirects.
- Map screen: UNIT and POINT buttons toggle their menus; tapping a point opens Point; long-press
  uses the last-used Add.
- Layers: summary counts, type-label search, row tap opens the right menu.
- Missions: row and delete-confirmation counts.

## 8. Out of scope

Point affiliation or per-type colors; range rings or areas around points; sharing points with
other users; point types beyond the 8; offline downloads of point symbols (they ship in the app).
