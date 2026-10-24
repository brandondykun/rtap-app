import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

export type MapItemKind = 'point' | 'line' | 'polygon';
/** The kinds this version of the app can show; a newer version may sync down others, which are left alone. */
export const MAP_ITEM_KINDS: readonly MapItemKind[] = ['point', 'line', 'polygon'];

export class MapItem extends Model {
  static table = Tables.mapItems;

  @field('mission_id') missionId!: string;
  @field('kind') kind!: MapItemKind;
  /** GeoJSON geometry JSON, WGS84 [lon, lat]. */
  @field('geometry') geometry!: string;
  @field('sidc') sidc!: string | null;
  @text('name') name!: string;
  @field('notes') notes!: string | null;
  /** JSON style for lines/polygons (later). */
  @field('style') style!: string | null;
  /** Ground elevation in meters above sea level where a unit was placed; null when unknown or not a unit. */
  @field('elevation_m') elevationM!: number | null;
  @field('created_by') createdBy!: string;
  @field('updated_by') updatedBy!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
