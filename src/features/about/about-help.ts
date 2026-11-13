import type { OverlayHelp } from '@/features/overlays/overlays-help';

/** The map screen itself, for the About page: the crosshair, the readouts, the map buttons and the menus. */
export const MAP_HELP: readonly OverlayHelp[] = [
  {
    title: 'CTR, the crosshair',
    help: 'The crosshair always marks the middle of the map. The CTR row under the map shows the grid beneath it, with its distance and bearing from you (from the OP in OP mode). Move the map to put the crosshair on a spot, then press CTR in any tool to use that spot.',
  },
  {
    title: 'ME, your position',
    help: 'The ME row shows your grid, your altitude and how accurate your GPS fix is (±). Tap it to center the map on you. If location is off, or your manual position is not set yet, the row says so: tap it to set your position.',
  },
  {
    title: 'Map buttons',
    help: 'Once you turn the map, a compass appears: tap it to turn the map back to north up. The + and − buttons zoom (Show zoom buttons in Settings), and pinching zooms either way.',
  },
  {
    title: 'Menus',
    help: 'Menus open as a sheet at the bottom (a drawer on the left in landscape), and the map stays usable behind them. Drag the sheet up or down to resize it. Tap the bar along its top edge (its right edge in landscape) to hide it, and the tab left behind to bring it back.',
  },
];

/** Adding, viewing and editing units, points, lines and polygons, for the About page. */
export const ITEMS_HELP: readonly OverlayHelp[] = [
  {
    title: 'Adding an item',
    help: 'Tap UNIT, POINT, LINE or POLYGON, then tap the map or press CTR to place it. Fill in its details and tap Save.',
  },
  {
    title: 'Drawing lines and polygons',
    help: 'Add one point at a time, by tapping the map or pressing CTR. Undo takes back the last change. To move a point, tap it, then tap the map or press Move to CTR, and Done. A polygon can also be a circle: set its center, then its edge, or type the radius.',
  },
  {
    title: 'Viewing an item',
    help: 'Tap an item on the map to open its card. A unit or point shows its grid with its distance (DIST), direction (DIR) and altitude (ALT) from you. A polygon shows its distance to the center, its perimeter (or radius) and its area. A line or polygon lists its points under Points: tap one to center the map on it.',
  },
  {
    title: 'Card buttons',
    help: 'Center moves the map to the item (Fit shows a whole line or polygon). Hide hides it on your map until you tap Show. Lengths shows the length of each side of a line or polygon on the map. Delete removes it: tap it twice to confirm.',
  },
  {
    title: 'Editing',
    help: 'Tap Edit, make your changes, then Save (or Cancel). To move a unit or point, type its grid, press Center to use the crosshair, or tap Map and then the map. Tap the notes to change them without opening Edit.',
  },
  {
    title: 'Range rings',
    help: 'Artillery and mortar units can have a threat range, and air defense units a horizontal and vertical range. Enter the range when adding or editing the unit; Ring on its card shows or hides the circle on the map.',
  },
];

/** Missions, for the About page. */
export const MISSIONS_HELP: readonly OverlayHelp[] = [
  {
    title: 'What a mission is',
    help: 'A mission is one map with its own units, points, lines, polygons and overlays. Your settings are shared by all your missions.',
  },
  {
    title: 'Switching and managing',
    help: 'Open Menu and tap Switch mission to see them all. Tap one to open it, or New to start one. Search by name, or sort by Recent, Name or Most items. Swipe a mission left to Edit its name or Delete it.',
  },
];
