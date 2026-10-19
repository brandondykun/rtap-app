import type { IconName } from '@/components/ui/Icon';

export type ToolbarHelp = { label: string; icon: IconName; help: string };

/** What each toolbar button does, in toolbar order (shown on the About page). Labels match the buttons. */
export const TOOLBAR_HELP: readonly ToolbarHelp[] = [
  { label: 'Menu', icon: 'menu', help: 'Switch to another mission, or open this About page.' },
  {
    label: 'UNIT',
    icon: 'rhombus-outline',
    help: 'Place a unit symbol. Tap the map, or press CTR to place it at the crosshair, then choose its affiliation and type.',
  },
  {
    label: 'POINT',
    icon: 'map-marker-outline',
    help: 'Place a control point, such as a checkpoint, observation post, landing zone or rally point. Tap the map or press CTR.',
  },
  {
    label: 'LINE',
    icon: 'vector-polyline',
    help: 'Draw a line, such as a phase line or route. Add points by tapping the map or pressing CTR, then save it.',
  },
  {
    label: 'POLYGON',
    icon: 'pentagon-outline',
    help: 'Draw an area, such as an objective or boundary. Add corners by tapping the map or pressing CTR, then save it.',
  },
  {
    label: 'MEASURE',
    icon: 'ruler',
    help: 'Measure the distance and bearing between two places. Set the start and end by tapping the map or pressing CTR.',
  },
  {
    label: 'LAYERS',
    icon: 'layers-outline',
    help: "List the mission's units, points, lines and polygons. Show or hide them one at a time or all at once.",
  },
  {
    label: 'PLOT',
    icon: 'target',
    help: 'Type a grid coordinate to drop a temporary point there, then save it as a unit or point, or discard it.',
  },
  {
    label: 'LABELS',
    icon: 'label-outline',
    help: 'Show or hide the names under items on the map. Point and unit names appear once you zoom in closer.',
  },
  {
    label: 'Settings',
    icon: 'cog-outline',
    help: 'Basemap, coordinate and angle formats, altitude units, north reference and declination, label size, and map display options.',
  },
];
