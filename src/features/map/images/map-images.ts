import type { ImageEntry } from '@rnmapbox/maps';

import { SYMBOL_IMAGES } from '@/features/symbology/symbol-images.generated';

import { LABEL_CHIP_IMAGE_OPTIONS } from './map-image-specs';

export const MAP_IMAGE_IDS = {
  self: 'self',
  selfNoHeading: 'self-no-heading',
  labelChip: 'label-chip',
  labelChipAccent: 'label-chip-accent',
  draftRing: 'draft-ring',
} as const;

/** Every image a map layer may reference by name (`iconImage`). Module constant: stable identity. */
export const MAP_IMAGES: Record<string, ImageEntry> = {
  ...SYMBOL_IMAGES,
  [MAP_IMAGE_IDS.self]: require('../../../../assets/map/self.png'),
  [MAP_IMAGE_IDS.selfNoHeading]: require('../../../../assets/map/self-no-heading.png'),
  [MAP_IMAGE_IDS.labelChip]: { image: require('../../../../assets/map/label-chip.png'), ...LABEL_CHIP_IMAGE_OPTIONS },
  [MAP_IMAGE_IDS.labelChipAccent]: { image: require('../../../../assets/map/label-chip-accent.png'), ...LABEL_CHIP_IMAGE_OPTIONS },
  [MAP_IMAGE_IDS.draftRing]: require('../../../../assets/map/draft-ring.png'),
};
