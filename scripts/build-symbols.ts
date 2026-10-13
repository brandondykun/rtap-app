/**
 * Renders the preset SIDCs with milsymbol into @1x/@2x/@3x PNGs (fill colors from theme
 * tokens) and writes src/features/symbology/symbol-images.generated.ts.
 * Run: npm run build:symbols
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ms from 'milsymbol';

import { drawSidcFor, LANDING_ZONE_SIDC, POINT_TYPES } from '../src/features/symbology/point-types';
import { decomposeSidc, PRESET_SIDCS, type Affiliation } from '../src/features/symbology/presets';
import { mapColors } from '../src/theme/tokens';

const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'assets/symbols');
const MODULE = join(ROOT, 'src/features/symbology/symbol-images.generated.ts');
const SYMBOL_SIZE = 30; // milsymbol size ≈ frame height in px at @1x
const colors = mapColors('dark');
const fill: Record<Affiliation, string> = {
  friend: colors.friendly,
  hostile: colors.hostile,
  neutral: colors.neutral,
  unknown: colors.unknown,
};

mkdirSync(OUT_DIR, { recursive: true });

/** Point symbols use the friendly-unit blue, so the two always match. */
const POINT_COLOR = colors.friendly;

/** milsymbol halo width for point symbols, in its drawing units. */
const POINT_OUTLINE_WIDTH = 2;
/** milsymbol draws tactical points with 3-unit lines and ignores `strokeWidth` for them. */
const POINT_BASE_LINE = 3;
/** We scale every stroke of a point symbol by this, so the lines read on imagery. */
const POINT_LINE_SCALE = 1.8;
/** milsymbol line weight for unit frames and icons (default 4). */
const UNIT_STROKE_WIDTH = 6;
/** milsymbol units per px at @1x: it draws on a 100-unit grid scaled to SYMBOL_SIZE. */
const PX_PER_UNIT = SYMBOL_SIZE / 100;
/** The point line weight and its halo in px, so the hand-drawn LZ matches the scaled milsymbol points. */
const POINT_LINE_PX = POINT_BASE_LINE * POINT_LINE_SCALE * PX_PER_UNIT;
const POINT_HALO_PX = POINT_OUTLINE_WIDTH * POINT_LINE_SCALE * PX_PER_UNIT;

/** Multiply every stroke width in milsymbol's SVG (lines and their halo). */
function thickenStrokes(svg: string, factor: number): string {
  return svg.replace(/stroke-width="([\d.]+)"/g, (_, w: string) => `stroke-width="${Number(w) * factor}"`);
}

function writePng(sidc: string, svg: string) {
  for (const scale of [1, 2, 3]) {
    const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale }, font: { loadSystemFonts: true } }).render().asPng();
    const suffix = scale === 1 ? '' : `@${scale}x`;
    writeFileSync(join(OUT_DIR, `${sidc}${suffix}.png`), png);
  }
}

/** Thicker strokes reach past milsymbol's own bounds: pad the canvas and let them draw there. */
const STROKE_PAD = POINT_HALO_PX + POINT_LINE_PX;

/**
 * An SVG trimmed to its visible pixels (menus and lists, where the symbol should fill its box).
 * milsymbol's bounds include empty room around tactical points, so measure the drawing instead.
 */
function trimmed(svg: string): string {
  const ZOOM = 4;
  const image = new Resvg(svg, { fitTo: { mode: 'zoom', value: ZOOM }, font: { loadSystemFonts: true } }).render();
  const { width, height, pixels } = image;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const [vx, vy, vw, vh] = [x0 / ZOOM, y0 / ZOOM, (x1 + 1 - x0) / ZOOM, (y1 + 1 - y0) / ZOOM];
  return svg.replace(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="[^"]+" height="[^"]+" viewBox="[^"]+">/, `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="${vx} ${vy} ${vw} ${vh}">`);
}

/**
 * Tactical points are anchored where the graphic marks the spot (a checkpoint's bottom tip), but
 * the map centers every image on its coordinate. Pad the canvas so the anchor is the center.
 */
function centeredOnAnchor(symbol: InstanceType<typeof ms.Symbol>, lineScale: number): string {
  const { x, y } = symbol.getAnchor();
  const { width, height } = symbol.getSize();
  const w = 2 * Math.max(x, width - x) + 2 * STROKE_PAD;
  const h = 2 * Math.max(y, height - y) + 2 * STROKE_PAD;
  const inner = thickenStrokes(symbol.asSVG(), lineScale).replace('<svg ', '<svg overflow="visible" ');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<g transform="translate(${w / 2 - x} ${h / 2 - y})">${inner}</g></svg>`
  );
}

/** Landing zone: milsymbol has no LZ point, so draw it in the same white-on-halo style. */
function landingZoneSvg(): string {
  const size = SYMBOL_SIZE + 6;
  const c = size / 2;
  const r = SYMBOL_SIZE / 2 - 2;
  const stroke = (color: string, width: number) =>
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    stroke(colors['point-symbol-halo'], POINT_LINE_PX + 2 * POINT_HALO_PX) +
    stroke(POINT_COLOR, POINT_LINE_PX) +
    `<text x="${c}" y="${c + 4.5}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="12" ` +
    `fill="${POINT_COLOR}" stroke="${colors['point-symbol-halo']}" stroke-width="${2 * POINT_HALO_PX}" paint-order="stroke">LZ</text>` +
    `</svg>`
  );
}

for (const sidc of PRESET_SIDCS) {
  const parts = decomposeSidc(sidc);
  if (!parts) throw new Error(`Unknown preset ${sidc}`);
  writePng(sidc, new ms.Symbol(sidc, { size: SYMBOL_SIZE, fillColor: fill[parts.affiliation], strokeWidth: UNIT_STROKE_WIDTH }).asSVG());
}

for (const type of POINT_TYPES) {
  if (type.sidc === LANDING_ZONE_SIDC) {
    writePng(type.sidc, landingZoneSvg());
    writePng(`${type.sidc}-thumb`, trimmed(landingZoneSvg()));
    continue;
  }
  const symbol = new ms.Symbol(drawSidcFor(type), {
    size: SYMBOL_SIZE,
    monoColor: POINT_COLOR,
    outlineColor: colors['point-symbol-halo'],
    outlineWidth: POINT_OUTLINE_WIDTH,
  });
  const svg = centeredOnAnchor(symbol, POINT_LINE_SCALE);
  writePng(type.sidc, svg);
  writePng(`${type.sidc}-thumb`, trimmed(svg));
}

const ALL_SIDCS = [...PRESET_SIDCS, ...POINT_TYPES.map((t) => t.sidc)];
const entries = ALL_SIDCS.map((sidc) => `  '${sidc}': require('../../../assets/symbols/${sidc}.png'),`).join('\n');
const thumbs = POINT_TYPES.map((t) => `  '${t.sidc}': require('../../../assets/symbols/${t.sidc}-thumb.png'),`).join('\n');
writeFileSync(
  MODULE,
  `// GENERATED by scripts/build-symbols.ts — do not edit.\n` +
    `export const SYMBOL_IMAGES: Record<string, number> = {\n${entries}\n};\n\n` +
    `/** Point symbols cropped to their own bounds, for menus and lists (map images are anchor-centered). */\n` +
    `export const SYMBOL_THUMBNAILS: Record<string, number> = {\n${thumbs}\n};\n`,
);
console.log(`Wrote ${(ALL_SIDCS.length + POINT_TYPES.length) * 3} PNGs and ${MODULE}`);
