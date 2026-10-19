import type { ImageEntry } from '@rnmapbox/maps';

import { LABEL_CHIP_IMAGE_OPTIONS } from './map-image-specs';

export const MAP_IMAGE_IDS = {
  self: 'self',
  selfNoHeading: 'self-no-heading',
  labelChip: 'label-chip',
  labelChipAccent: 'label-chip-accent',
  draftRing: 'draft-ring',
  lineArrow: 'line-arrow',
  lineFlotArc: 'line-flot-arc',
  lineVertex: 'line-vertex',
  tempReticle: 'temp-reticle',
} as const;

/** Fixed app images; symbols are registered at runtime (useSymbolImages). Module constant: stable identity. */
export const MAP_IMAGES: Record<string, ImageEntry> = {
  [MAP_IMAGE_IDS.self]: require('../../../../assets/map/self.png'),
  [MAP_IMAGE_IDS.selfNoHeading]: require('../../../../assets/map/self-no-heading.png'),
  [MAP_IMAGE_IDS.labelChip]: { image: require('../../../../assets/map/label-chip.png'), ...LABEL_CHIP_IMAGE_OPTIONS },
  [MAP_IMAGE_IDS.labelChipAccent]: { image: require('../../../../assets/map/label-chip-accent.png'), ...LABEL_CHIP_IMAGE_OPTIONS },
  [MAP_IMAGE_IDS.draftRing]: require('../../../../assets/map/draft-ring.png'),
  [MAP_IMAGE_IDS.lineArrow]: require('../../../../assets/map/line-arrow.png'),
  [MAP_IMAGE_IDS.lineFlotArc]: require('../../../../assets/map/line-flot-arc.png'),
  [MAP_IMAGE_IDS.lineVertex]: require('../../../../assets/map/line-vertex.png'),
  [MAP_IMAGE_IDS.tempReticle]: require('../../../../assets/map/temp-reticle.png'),
};
