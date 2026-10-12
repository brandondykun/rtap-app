/**
 * Public Mapbox token from `.env` (EXPO_PUBLIC_MAPBOX_TOKEN); null when missing or blank.
 * The default must stay a static `process.env.EXPO_PUBLIC_…` access so Expo inlines it.
 */
export function getMapboxToken(raw: string | undefined = process.env.EXPO_PUBLIC_MAPBOX_TOKEN): string | null {
  const token = raw?.trim();
  return token ? token : null;
}
