# Missions screen redesign

Mockups: `Missions — list@2x.png` (portrait) and `Missions — list (Landscape)@2x.png` (landscape), shared
in conversation on 2026-10-19.

## Goal

Replace the plain missions list with a visual one: a pinned card for the last-opened mission with a picture
of its map, smaller cards with thumbnails for the rest, sort chips and search. Map pictures are static images
captured from the live mission map, never live map components, so the list stays fast.

## Map pictures

- **What:** where you left off: the live mission map at its last camera, symbology included (units, lines and
  polygons are GL layers, so `MapView.takeSnap()` captures them).
- **When:** when leaving a mission screen, and when the app goes to the background while a mission is open.
  Leaving waits for the capture at most 1 s; a failed or slow capture never blocks navigation and keeps the
  previous picture.
- **Storage:** downscaled to 720 px wide, JPEG (quality 0.7), written to
  `<documentDirectory>/mission-snapshots/<missionId>.jpg` (overwriting the previous one).
  Path and capture time are stored on `mission_view_state` in a new nullable `snapshot` column
  (JSON `{ uri, takenAt }`), local to the device like the camera. Schema version 2 with a migration adding
  the column.
- **Cache busting:** the list keys the image by `takenAt`, so a fresh capture replaces the old one on screen.
- **Delete:** deleting a mission deletes its picture file (missing file is not an error).
- **No picture:** the dashed map-icon placeholder from the mockup.
- **Dependencies:** `expo-image-manipulator` (new native module; needs a new development build) and
  `expo-file-system` as a direct dependency, both via `npx expo install`.

## Screen

### Header

- "MISSIONS" title; subtitle "N missions · N units plotted" (units summed across missions, singular forms
  for 1). Portrait: subtitle under the title. Landscape: beside it.
- Search button (magnifier) and amber "+ New" button (opens `/missions/new`).
- Sort chips: **Recent** (last opened, never-opened last, then by name), **Name** (case-insensitive A–Z),
  **Most items** (total items, ties by Recent). The active chip uses the amber selected style. The choice
  persists in the settings store; default Recent. Portrait: chips on their own row. Landscape: chips in the
  header row, left of search and New.

### Last opened card (pinned)

- The most recently opened mission, whatever the sort; absent when no mission has been opened.
- Map picture across the top with a "● LAST OPENED" tag (top left) and the camera's 100 km MGRS square,
  e.g. "18S UJ" (top right; hidden without a saved camera). Placeholder when there is no picture.
- Name, "Opened 1 min ago" (`formatLastOpened`), amber "Resume ›" button; tapping the card or Resume opens
  the mission.
- Divider, then four stats with category icons and colors: UNITS, POINTS, LINES, POLYGONS.
- Amber-tinted border as in the mockup. Swipe to edit or delete like the other rows.

### Other missions

- Section heading by sort: EARLIER (Recent), BY NAME (Name), MOST ITEMS (Most items).
- Each card: square thumbnail (picture or placeholder), name, "Opened … · <MGRS square>" (square omitted
  without a camera; "Never opened" when never opened), a counts row with category icons, and a chevron.
  An empty mission shows "Empty — nothing plotted yet" instead of the counts.
- Swipe left for edit and delete (existing behavior and confirmation), with the hint "‹ Swipe a mission for
  edit & delete" at the bottom of the list.

### Search

- The search button swaps the chips row for a name field (autofocused) and Cancel. Filters missions by name,
  case-insensitively, as you type. While searching, the pinned card hides and results show as a plain list of
  small cards in the active sort. No matches: "No missions match “…”". Cancel clears and restores the chips.

### Landscape

- Two columns: the pinned card on the left, the heading and list scrolling on the right; the hint at the bottom
  of the right column. Without a pinned card (or while searching) the list spans both columns.

### Kept

- Empty state when there are no missions, the dev-only performance seed button, swipe actions and the delete
  confirmation.

## Testing

- Unit: sorting (all three, ties), search filter, MGRS square label, units-plotted subtitle, snapshot save
  (path, JSON column, overwrite), snapshot delete with the mission, migration to v2.
- Screen: pinned card content and Resume, placeholders, chips change order and heading, search hides the
  pinned card and filters, landscape two columns, swipe hint.
- Manual (device): capture on leaving and on backgrounding, picture shows symbology, list updates after a
  new capture.
