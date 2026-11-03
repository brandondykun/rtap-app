/** One point of the About page's Overlays section: a short title, then what to know. */
export type OverlayHelp = { title: string; help: string };

/** How overlays work, for the About page, in the order a user meets them. */
export const OVERLAYS_HELP: readonly OverlayHelp[] = [
  {
    title: 'What an overlay is',
    help: 'A named group of map items that you turn on and off together, such as Phase 1, Phase 2 or Fires. Use overlays to show only the graphics you need right now.',
  },
  {
    title: 'Base',
    help: 'Every new item starts in Base. Base is always listed first, and you can turn it off like any other overlay to see an overlay on its own.',
  },
  {
    title: 'Turning overlays on and off',
    help: 'Open Layers. The chips above the tabs are your overlays: tap one to turn it on or off. A lit (amber) chip is on. Turning an overlay off hides its items on your map.',
  },
  {
    title: 'Putting an item in an overlay',
    help: 'Tap the item on the map. Under Overlays, tap an overlay to add the item to it, and tap it again to take the item out. Adding an item to an overlay moves it out of Base; tap Base to move it back.',
  },
  {
    title: 'Items in several overlays',
    help: 'An item can be in more than one overlay, such as a phase line used in Phases 1 to 3. It stays on the map as long as at least one of its overlays is turned on.',
  },
  {
    title: 'Adding, renaming and deleting',
    help: 'In Layers, tap Add overlay (or Overlays, once you have some) to add, rename or delete overlays. Deleting an overlay does not delete its items; any item not in another overlay moves back to Base.',
  },
  {
    title: 'Only your map',
    help: 'Turning overlays on and off only changes what you see. It does not change anyone else\'s map.',
  },
];
