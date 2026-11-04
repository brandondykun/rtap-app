import type { OverlayHelp } from '@/features/overlays/overlays-help';

/** How Average mode works, for the About page, in the order a user meets it. */
export const AVERAGE_HELP: readonly OverlayHelp[] = [
  {
    title: 'What it does',
    help: 'Tap AVG in the toolbar while you stay in one spot. Instead of jumping with each GPS reading, ME becomes the average of all of them, which settles closer to where you really are. Fixes that are too poor (worse than ±30 m) or far out of line with the rest are left out.',
  },
  {
    title: 'How long to average',
    help: 'Keep the device still. Most of the gain comes in the first few minutes, and it keeps improving the longer you stay, because GPS errors wander slowly and need time to cancel out. The ± never claims better than 2 m.',
  },
  {
    title: 'Reading the display',
    help: 'An orange frame goes around the grid display. Its top line reads AVERAGE MODE with a slowly blinking dot, the time spent averaging (1hr+ after an hour) and the number of fixes so far (1.2K is 1,200). Your row is tagged AVG, and its ± is the average’s.',
  },
  {
    title: 'If you move',
    help: 'Averaging pauses on its own when the GPS or the motion sensor shows you moving, and drops the readings from just before. ME stays on the averaged spot, marked HELD, and the top line says how far you are from it. Go back and tap Resume to carry on, or Discard to turn Average mode off.',
  },
  {
    title: 'Away from the spot',
    help: 'Resume only carries on when a fresh GPS fix puts you back on the spot. Otherwise you are away: tap Start new here to begin a new average where you stand, or Turn off.',
  },
  {
    title: 'Seeing the fixes',
    help: 'Tap the fix count to show the fixes on the map: an orange dot for each fix in the average, a faint ring for its accuracy, and a dashed ring for the average’s own ±. Tap it again to hide them. A tight cluster means a good average.',
  },
  {
    title: 'Orange means Average mode',
    help: 'Orange marks Average mode only: the frame, the AVG tag, HELD and the fixes. It never colors a value, and your grid stays blue.',
  },
];
