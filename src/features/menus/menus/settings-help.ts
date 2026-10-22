/**
 * `name` matches the Settings menu: a toggle's label, or the section label of a choice. `choices` lists the options
 * of a choice, as the menu shows them.
 */
export type SettingHelp = { name: string; choices?: string; help: string };

/** What each setting does (shown on the About page), in Settings menu order. A test keeps it in step with the menu. */
export const SETTINGS_HELP: readonly SettingHelp[] = [
  {
    name: 'Basemap',
    choices: 'Satellite · Hybrid · Topo · Dark',
    help: 'The map underneath. Hybrid adds roads and place names to the imagery, Topo is a contour map, Dark is a dim street map.',
  },
  { name: 'Coordinates', choices: 'MGRS · Lat/Lon', help: 'How positions show in the readouts and menus.' },
  { name: 'Angles', choices: 'Degrees · Mils', help: 'The unit for bearings and the G-M angle. A full circle is 360° or 6400 mils.' },
  { name: 'Altitude', choices: 'Meters · Feet', help: 'The unit for your altitude, GPS accuracy and OP ground elevation.' },
  {
    name: 'North reference',
    choices: 'Grid · Magnetic · True',
    help: 'Which north bearings are measured from. The G-M angle under it is what to set on a compass against the map grid.',
  },
  {
    name: 'Manual declination',
    help: 'The app works out declination for where you are (WMM2025). Turn this on to enter your own, for example from your map sheet.',
  },
  { name: 'Label text size', choices: 'Small · Medium · Large', help: 'The size of names on units, points, lines and polygons.' },
  { name: 'Show zoom buttons', help: 'The + and − buttons. Pinch to zoom works either way.' },
  { name: 'Show center grid', help: 'The CTR readout of the grid under the crosshair.' },
  { name: 'Show toolbar text', help: 'The names under the toolbar icons.' },
  { name: '3D terrain height', choices: '1× · 1.5× · 2× · 3×', help: 'How much hills are raised in 3D. 1× is true scale.' },
  {
    name: 'Panel background',
    choices: 'Clear · Light · Heavy · Solid',
    help: 'How much the toolbar, readouts and map buttons hide the map. Heavier reads better over snow.',
  },
];
