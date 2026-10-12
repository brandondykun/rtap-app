/**
 * Renders the self-position icons and the map label chip into assets/map/ (colors from theme
 * tokens). Run: npm run build:map-images
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { LABEL_CHIP_SPEC, SELF_ICON_SIZE } from '../src/features/map/images/map-image-specs';
import { mapColors } from '../src/theme/tokens';

const OUT_DIR = join(__dirname, '..', 'assets/map');
const colors = mapColors('dark');
const S = SELF_ICON_SIZE;
const C = S / 2;

// View cone: ±25° wedge pointing north, radius 30.
const CONE_R = 30;
const dx = CONE_R * Math.sin((25 * Math.PI) / 180);
const dy = CONE_R * Math.cos((25 * Math.PI) / 180);
const cone = `<path d="M${C} ${C} L${C - dx} ${C - dy} A${CONE_R} ${CONE_R} 0 0 1 ${C + dx} ${C - dy} Z" fill="${colors.self}" fill-opacity="0.35"/>`;
// White-ringed disc (ring uses the primary text color) with a dark north-pointing arrow.
const disc = `<circle cx="${C}" cy="${C}" r="11" fill="${colors.self}" stroke="${colors.text}" stroke-width="3"/>`;
const arrow = `<path d="M${C} ${C - 8} L${C + 6} ${C + 7} L${C} ${C + 3.5} L${C - 6} ${C + 7} Z" fill="${colors['surface-input']}"/>`;
const dot = `<circle cx="${C}" cy="${C}" r="3" fill="${colors['surface-input']}"/>`;

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${body}</svg>`;

function writeScaled(name: string, source: string) {
  for (const scale of [1, 2, 3]) {
    const png = new Resvg(source, { fitTo: { mode: 'zoom', value: scale } }).render().asPng();
    writeFileSync(join(OUT_DIR, `${name}${scale === 1 ? '' : `@${scale}x`}.png`), png);
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeScaled('self', svg(cone + disc + arrow));
writeScaled('self-no-heading', svg(disc + dot));

const { sizePx, radiusPx } = LABEL_CHIP_SPEC;
const chip = `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}"><rect width="${sizePx}" height="${sizePx}" rx="${radiusPx}" fill="${colors['map-label-bg']}"/></svg>`;
writeFileSync(join(OUT_DIR, 'label-chip.png'), new Resvg(chip).render().asPng());

console.log(`Wrote map images to ${OUT_DIR}`);
