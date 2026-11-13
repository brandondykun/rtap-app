import type { IconName } from '@/components/ui/Icon';

export type HelpGroup = 'plot' | 'read' | 'app';

/** Sections of the About page's toolbar guide, in page order. */
export const HELP_GROUPS: readonly { id: HelpGroup; title: string }[] = [
  { id: 'plot', title: 'Plot on the map' },
  { id: 'read', title: 'Read the map' },
  { id: 'app', title: 'App' },
];

/** `label` matches the toolbar button's accessibility label. */
export type ToolbarHelp = { label: string; icon: IconName; help: string; group: HelpGroup };

/** What each toolbar button does (shown on the About page), grouped and in page order. */
export const TOOLBAR_HELP: readonly ToolbarHelp[] = [
  { group: 'plot', label: 'UNIT', icon: 'rhombus-outline', help: 'Place a unit, then pick its affiliation, type and echelon.' },
  { group: 'plot', label: 'POINT', icon: 'map-marker-outline', help: 'Mark a checkpoint, OP, target, landing zone, rally point and more.' },
  { group: 'plot', label: 'LINE', icon: 'vector-polyline', help: 'Draw a phase line, route, boundary or fire support line, point by point.' },
  { group: 'plot', label: 'POLYGON', icon: 'pentagon-outline', help: 'Outline an area, like an objective or engagement area, point by point or as a circle.' },
  { group: 'plot', label: 'PLOT', icon: 'target', help: 'Type an MGRS grid to drop a temporary point and see its distance and direction from you. Save it as a unit or point, or clear it.' },
  { group: 'read', label: 'MEASURE', icon: 'ruler', help: 'Distance and bearing from point 1 to point 2. Tap the map or press Set at CTR to set each one (tapping a unit or point snaps to it). Once both are set, tap either point to move it.' },
  { group: 'read', label: 'AVG', icon: 'crosshairs-gps', help: 'Average your GPS position while you stay still, for a steadier, more accurate ME. If you move, or tap AVG again, it pauses, holding the average until you Resume or Stop it under the grids.' },
  { group: 'read', label: 'LAYERS', icon: 'layers-outline', help: 'List every item in the mission, by type or by name search: tap one to open it, or show and hide them one at a time. Turn whole overlays (groups of items, like the phases of an operation) on and off.' },
  { group: 'read', label: 'LABELS', icon: 'label-outline', help: 'Turn the names on map items on or off.' },
  { group: 'read', label: '3D', icon: 'video-3d', help: 'Tilt the map to see hills and valleys in 3D.' },
  { group: 'read', label: 'OP', icon: 'binoculars', help: 'See the 3D map as you would standing on the ground. Tap the map or press CTR to pick your spot, then drag to look around. The slider sets your eye height.' },
  { group: 'app', label: 'Menu', icon: 'menu', help: 'Switch missions, change settings or open this page.' },
];
