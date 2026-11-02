/**
 * `name` matches the Settings menu: a toggle's label, or the section label of a choice. `choices` lists the options
 * of a choice, as the menu shows them.
 */
export type SettingHelp = { name: string; choices?: string; help: string };

/** What each setting does (shown on the About page), in Settings menu order. A test keeps it in step with the menu. */
export const SETTINGS_HELP: readonly SettingHelp[] = [
  {
    name: 'Use my position from',
    choices: 'GPS · Manual',
    help: 'Where your position comes from. Manual uses a position you set by hand, for when GPS is off or jammed, and stops using GPS. Switching back to GPS clears it.',
  },
  { name: 'Callsign', help: 'The name your team will see you by once missions are shared. Kept on this phone.' },
  {
    name: 'Basemap',
    choices: 'Satellite · Hybrid · Topo · Dark',
    help: 'The map underneath. Hybrid adds roads and place names to the imagery, Topo is a contour map, Dark is a dim street map.',
  },
  { name: 'Label text size', choices: 'Small · Medium · Large', help: 'The size of names on units, points, lines and polygons.' },
  { name: '3D terrain height', choices: '1× · 1.5× · 2× · 3×', help: 'How much hills are raised in 3D. 1× is true scale.' },
  { name: 'Terrain in 2D', help: 'Raises hills at true scale in 2D.' },
  {
    name: 'Long press to add unit',
    help: 'Long pressing on the map adds an enemy unit there, moves the unit you are adding or editing, or adds a point while drawing.',
  },
  {
    name: 'Show MGRS grid',
    help: 'Grid lines over the map. They get finer as you zoom in: grid zones, then 100 km, 10 km, 1 km and 100 m squares.',
  },
  {
    name: 'Show grid labels',
    help: 'Numbers on the grid lines (kilometres, or hundreds of metres, within the 100 km square), and the grid zone and 100 km square names when zoomed out.',
  },
  { name: 'Show 100 m grid lines', help: 'The finest grid lines, when zoomed in close. Turn it off to stop at 1 km lines.' },
  {
    name: 'Grid color',
    choices: 'White · Light gray · Gray · Dark gray · Black',
    help: 'The shade of the MGRS grid lines and numbers. Pick one that stands out from the ground: white over dark forest, black over snow.',
  },
  { name: 'Coordinates', choices: 'MGRS · Lat/Lon', help: 'How positions show in the readouts and menus.' },
  { name: 'Angles', choices: 'Degrees · Mils', help: 'The unit for bearings and the G-M angle. A full circle is 360° or 6400 mils.' },
  { name: 'Altitude', choices: 'Meters · Feet', help: 'The unit for altitudes (yours, the OP\'s, units\' and points\'), GPS accuracy and the OP eye height.' },
  {
    name: 'North reference',
    choices: 'Grid · Magnetic · True',
    help: 'Which north bearings are measured from. The G-M angle under it is what to set on a compass against the map grid, with whether to add or subtract it here.',
  },
  {
    name: 'Manual declination',
    help: 'The app works out declination for where you are (WMM2025). Turn this on to enter your own, for example from your map sheet.',
  },
  { name: 'Show zoom buttons', help: 'The + and − buttons. Pinch to zoom works either way.' },
  { name: 'Show center grid', help: 'The CTR readout of the grid under the crosshair.' },
  { name: 'Minimal grids in landscape', help: 'In landscape, the readout shows only the CTR grid and yours, without distance, bearing, altitude or accuracy.' },
  { name: 'Show toolbar text', help: 'The names under the toolbar icons.' },
  {
    name: 'Panel background',
    choices: 'Clear · Light · Heavy · Solid',
    help: 'How much the toolbar, readouts and map buttons hide the map. Heavier reads better over snow.',
  },
];
