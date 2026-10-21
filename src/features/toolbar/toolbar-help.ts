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
  { group: 'plot', label: 'UNIT', icon: 'rhombus-outline', help: 'Place a unit, then pick its affiliation and type.' },
  { group: 'plot', label: 'POINT', icon: 'map-marker-outline', help: 'Mark a checkpoint, OP, landing zone or rally point.' },
  { group: 'plot', label: 'LINE', icon: 'vector-polyline', help: 'Draw a phase line or route, point by point.' },
  { group: 'plot', label: 'POLYGON', icon: 'pentagon-outline', help: 'Outline an area, like an objective or boundary.' },
  { group: 'plot', label: 'PLOT', icon: 'target', help: 'Type a grid to drop a temp point, then save it or discard it.' },
  { group: 'read', label: 'MEASURE', icon: 'ruler', help: 'Distance and bearing between two places.' },
  { group: 'read', label: 'LAYERS', icon: 'layers-outline', help: 'Show or hide units, points, lines and polygons.' },
  { group: 'read', label: 'LABELS', icon: 'label-outline', help: 'Turn the names on map items on or off.' },
  { group: 'read', label: '3D', icon: 'video-3d', help: 'Tilt the map to see hills and valleys in 3D.' },
  { group: 'app', label: 'Menu', icon: 'menu', help: 'Switch missions, change settings or open this page.' },
];
