/** Longest callsign, in characters. */
export const CALLSIGN_MAX = 16;

export const CALLSIGN_RULE = `Up to ${CALLSIGN_MAX} letters, numbers, spaces or hyphens`;

const VALID = new RegExp(`^[A-Z0-9][A-Z0-9 -]{0,${CALLSIGN_MAX - 1}}$`);

/** The callsign as stored (trimmed, capitals, single spaces), or null when it is empty or breaks CALLSIGN_RULE. */
export function normalizeCallsign(raw: string): string | null {
  const callsign = raw.trim().replace(/\s+/g, ' ').toUpperCase();
  return VALID.test(callsign) ? callsign : null;
}
