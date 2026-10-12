import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

export type MapItemKind = 'point';

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
  @field('created_by') createdBy!: string;
  @field('updated_by') updatedBy!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
