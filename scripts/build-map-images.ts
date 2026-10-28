/**
 * Renders the self-position icons and the map label chip into assets/map/ (colors from theme
 * tokens). Run: npm run build:map-images
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DRAFT_RING_RADIUS, DRAFT_RING_SIZE, LABEL_CHIP_SPEC, SELF_ICON_SIZE } from '../src/features/map/images/map-image-specs';
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

// Chips are drawn at 3× and saved under their @3x name (see LABEL_CHIP_SPEC for why there is no scale option).
const { sizePx, radiusPx, scale: chipScale } = LABEL_CHIP_SPEC;
const chipFile = (name: string) => join(OUT_DIR, `${name}@${chipScale}x.png`);
const chip = `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}"><rect width="${sizePx}" height="${sizePx}" rx="${radiusPx}" fill="${colors['map-label-bg']}"/></svg>`;
writeFileSync(chipFile('label-chip'), new Resvg(chip).render().asPng());
// Square chip for line labels: scaled as one piece (no stretch zones), so it stays whole when rotated.
const squareChip = `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}"><rect width="${sizePx}" height="${sizePx}" fill="${colors['map-label-bg']}"/></svg>`;
writeFileSync(chipFile('label-chip-square'), new Resvg(squareChip).render().asPng());

// Draft selection ring: dashed amber circle with four tick marks (mockup "HOS-4 · NEW").
const D = DRAFT_RING_SIZE;
const DC = D / 2;
const ticks = [0, 90, 180, 270]
  .map((a) => {
    const r = (a * Math.PI) / 180;
    const [sx, sy] = [Math.sin(r), -Math.cos(r)];
    const x1 = DC + sx * (DRAFT_RING_RADIUS + 3);
    const y1 = DC + sy * (DRAFT_RING_RADIUS + 3);
    const x2 = DC + sx * (DRAFT_RING_RADIUS + 11);
    const y2 = DC + sy * (DRAFT_RING_RADIUS + 11);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors.accent}" stroke-width="2.5" stroke-linecap="round"/>`;
  })
  .join('');
const ring = `<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}" viewBox="0 0 ${D} ${D}"><circle cx="${DC}" cy="${DC}" r="${DRAFT_RING_RADIUS}" fill="${colors.accent}" fill-opacity="0.15" stroke="${colors.accent}" stroke-width="2" stroke-dasharray="5 4"/>${ticks}</svg>`;
writeScaled('draft-ring', ring);

// Accent label chip for the draft ("HOS-4 · NEW"): same geometry as the dark chip.
const accentChip = `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}"><rect width="${sizePx}" height="${sizePx}" rx="${radiusPx}" fill="${colors.accent}"/></svg>`;
writeFileSync(chipFile('label-chip-accent'), new Resvg(accentChip).render().asPng());

console.log(`Wrote map images to ${OUT_DIR}`);

// Line end arrow: a filled chevron pointing up (north); the layer rotates it to the line's bearing.
const A = 24;
const arrowPath = `M${A / 2} 3 L${A - 4} ${A - 5} L${A / 2} ${A - 9} L4 ${A - 5} Z`;
const lineArrow = `<svg xmlns="http://www.w3.org/2000/svg" width="${A}" height="${A}" viewBox="0 0 ${A} ${A}"><path d="${arrowPath}" fill="${colors.friendly}" stroke="${colors['point-symbol-halo']}" stroke-width="2" stroke-linejoin="round"/></svg>`;
writeScaled('line-arrow', lineArrow);

// FLOT decoration: a small semicircle (bump) repeated along the line.
const F = 14;
const flot = `<svg xmlns="http://www.w3.org/2000/svg" width="${F}" height="${F}" viewBox="0 0 ${F} ${F}"><path d="M2 ${F / 2} A5 5 0 0 1 ${F - 2} ${F / 2}" fill="none" stroke="${colors['point-symbol-halo']}" stroke-width="4"/><path d="M2 ${F / 2} A5 5 0 0 1 ${F - 2} ${F / 2}" fill="none" stroke="${colors.friendly}" stroke-width="2"/></svg>`;
writeScaled('line-flot-arc', flot);

// Draft vertex: white disc with a dark ring; the number is drawn as text on top.
const V = 22;
const vertex = `<svg xmlns="http://www.w3.org/2000/svg" width="${V}" height="${V}" viewBox="0 0 ${V} ${V}"><circle cx="${V / 2}" cy="${V / 2}" r="${V / 2 - 1.5}" fill="${colors.text}" stroke="${colors['surface-input']}" stroke-width="2"/></svg>`;
writeScaled('line-vertex', vertex);

// Quick plot temporary point: amber reticle — translucent disc, dashed ring, four ticks, center dot.
const R = 56;
const RC = R / 2;
const tick = (x1: number, y1: number, x2: number, y2: number) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors['point-symbol-halo']}" stroke-width="5" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors.accent}" stroke-width="2.5" stroke-linecap="round"/>`;
const reticle = `<svg xmlns="http://www.w3.org/2000/svg" width="${R}" height="${R}" viewBox="0 0 ${R} ${R}"><circle cx="${RC}" cy="${RC}" r="${RC - 2}" fill="${colors.accent}" fill-opacity="0.15" stroke="${colors.accent}" stroke-opacity="0.5" stroke-width="1.5"/><circle cx="${RC}" cy="${RC}" r="${RC - 12}" fill="none" stroke="${colors.accent}" stroke-width="2.5" stroke-dasharray="5 4"/>${tick(RC, 4, RC, 16)}${tick(RC, R - 16, RC, R - 4)}${tick(4, RC, 16, RC)}${tick(R - 16, RC, R - 4, RC)}<circle cx="${RC}" cy="${RC}" r="4" fill="${colors.text}" stroke="${colors.accent}" stroke-width="2.5"/></svg>`;
writeScaled('temp-reticle', reticle);
