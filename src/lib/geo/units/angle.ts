/** NATO mils per full circle. The app supports no other mil system. */
export const MILS_PER_CIRCLE = 6400;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Normalizes any angle in degrees into [0, 360). Never returns -0. */
export function normalizeDeg(deg: number): number {
  const r = ((deg % 360) + 360) % 360;
  return r === 0 || r === 360 ? 0 : r;
}

/** Normalizes a longitude into [-180, 180). */
export function wrapLon(lon: number): number {
  const r = normalizeDeg(lon + 180) - 180;
  return r === 0 ? 0 : r;
}

export function degToMils(deg: number): number {
  const mils = (normalizeDeg(deg) * MILS_PER_CIRCLE) / 360;
  return mils >= MILS_PER_CIRCLE ? 0 : mils;
}

export function milsToDeg(mils: number): number {
  return normalizeDeg((mils * 360) / MILS_PER_CIRCLE);
}
