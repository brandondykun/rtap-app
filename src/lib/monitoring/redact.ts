/** Zone, latitude band, 100 km square, then up to two 1–5 digit easting/northing groups. Over-matching is fine here. */
const MGRS = /\b\d{1,2}\s?[C-HJ-NP-X]\s?[A-HJ-NP-Z]{2}(?:\s?\d{1,10})?(?:\s\d{1,5})?\b/gi;
/** Four or more decimals is ~11 m or finer: a position, not a duration or version. */
const DECIMAL_COORD = /-?\b\d{1,3}\.\d{4,}\b/g;

/** Strips anything that looks like a grid or a lat/long from text bound for crash reports. */
export function redactLocation(text: string): string {
  return text.replace(MGRS, '[grid]').replace(DECIMAL_COORD, '[coord]');
}
