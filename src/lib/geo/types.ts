/** WGS84 position in decimal degrees. */
export type LatLon = { readonly lat: number; readonly lon: number };

/** North reference a bearing is expressed against. */
export type NorthRef = 'true' | 'grid' | 'magnetic';

/** Unit used to display angles. Mils are always NATO 6400. */
export type AngleUnit = 'deg' | 'mil';
