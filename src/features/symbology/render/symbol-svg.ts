import ms from 'milsymbol';

import { mapColors } from '@/theme/tokens';

import { affiliationOf, type Affiliation } from '../presets';
import { drawSidcFor, LANDING_ZONE_SIDC, POINT_TYPES, type PointTypeInfo } from '../point-types';

const colors = mapColors('dark');
const SYMBOL_SIZE = 30; // milsymbol size ≈ frame height in px at @1x
const UNIT_STROKE_WIDTH = 6;
/** Point symbols use the friendly-unit blue, so the two always match. */
const POINT_COLOR = colors.friendly;
const POINT_OUTLINE_WIDTH = 2;
/** milsymbol draws tactical points with 3-unit lines and ignores `strokeWidth` for them. */
const POINT_BASE_LINE = 3;
/** Every stroke of a point symbol is scaled by this, so the lines read on imagery. */
const POINT_LINE_SCALE = 1.8;
const PX_PER_UNIT = SYMBOL_SIZE / 100;
const POINT_LINE_PX = POINT_BASE_LINE * POINT_LINE_SCALE * PX_PER_UNIT;
const POINT_HALO_PX = POINT_OUTLINE_WIDTH * POINT_LINE_SCALE * PX_PER_UNIT;
/** Thicker strokes reach past milsymbol's own bounds: pad the canvas and let them draw there. */
const STROKE_PAD = POINT_HALO_PX + POINT_LINE_PX;

const UNIT_FILL: Record<Affiliation, string> = { friend: colors.friendly, hostile: colors.hostile, neutral: colors.neutral, unknown: colors.unknown };
const POINT_BY_SIDC = new Map<string, PointTypeInfo>(POINT_TYPES.map((t) => [t.sidc, t]));

export function isPointSidc(sidc: string): boolean {
  return POINT_BY_SIDC.has(sidc);
}

function thickenStrokes(svg: string, factor: number): string {
  return svg.replace(/stroke-width="([\d.]+)"/g, (_, w: string) => `stroke-width="${Number(w) * factor}"`);
}

/** Skia ignores `dominant-baseline`: move each middle-baseline label's baseline down by 0.35em instead. */
function middleBaselineAsShift(svg: string): string {
  return svg.replace(/<text\b[^>]*\sdominant-baseline="middle"[^>]*>/g, (tag) => {
    const fontSize = Number(/\sfont-size="([\d.]+)"/.exec(tag)?.[1] ?? 0);
    return tag
      .replace(/\sdominant-baseline="middle"/, '')
      .replace(/\sy="(-?[\d.]+)"/, (_, y: string) => ` y="${Number(y) + 0.35 * fontSize}"`);
  });
}

/**
 * Mapbox centers an image on its coordinate, so pad the symbol until its anchor (where it marks the
 * spot: a point's tip, a unit frame's center below any echelon mark) is the image center.
 */
function centeredOnAnchor(symbol: InstanceType<typeof ms.Symbol>, lineScale: number, pad: number): string {
  const { x, y } = symbol.getAnchor();
  const { width, height } = symbol.getSize();
  const w = 2 * Math.max(x, width - x) + 2 * pad;
  const h = 2 * Math.max(y, height - y) + 2 * pad;
  const inner = middleBaselineAsShift(thickenStrokes(symbol.asSVG(), lineScale)).replace('<svg ', '<svg overflow="visible" ');
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
  const label = (paint: string) =>
    `<text x="${c}" y="${c + 4.5}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="12" ${paint}>LZ</text>`;
  const stroke = (color: string, width: number) => `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    stroke(colors['point-symbol-halo'], POINT_LINE_PX + 2 * POINT_HALO_PX) +
    stroke(POINT_COLOR, POINT_LINE_PX) +
    // Skia ignores paint-order: draw the halo text first, then the fill on top.
    label(`fill="none" stroke="${colors['point-symbol-halo']}" stroke-width="${2 * POINT_HALO_PX}" stroke-linejoin="round"`) +
    label(`fill="${POINT_COLOR}"`) +
    `</svg>`
  );
}

/** The map image for any SIDC, as SVG, centered on its anchor: units filled by affiliation, the LZ hand-drawn. */
export function symbolSvg(sidc: string): string {
  if (sidc === LANDING_ZONE_SIDC) return landingZoneSvg();
  const point = POINT_BY_SIDC.get(sidc);
  if (point) {
    const symbol = new ms.Symbol(drawSidcFor(point), {
      size: SYMBOL_SIZE,
      ...(point.ownColors ? {} : { monoColor: POINT_COLOR }),
      outlineColor: colors['point-symbol-halo'],
      outlineWidth: POINT_OUTLINE_WIDTH,
    });
    return centeredOnAnchor(symbol, POINT_LINE_SCALE, STROKE_PAD);
  }
  const unit = new ms.Symbol(sidc, { size: SYMBOL_SIZE, fillColor: UNIT_FILL[affiliationOf(sidc) ?? 'unknown'], strokeWidth: UNIT_STROKE_WIDTH });
  return centeredOnAnchor(unit, 1, 0);
}
