import { Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

/** Local-only: per-device visibility of a map item. No row = visible. */
export class ItemViewState extends Model {
  static table = Tables.itemViewState;

  @field('map_item_id') mapItemId!: string;
  @field('hidden') hidden!: boolean;
  /** Whether this device shows the item's range ring; null = not chosen. */
  @field('show_ring') showRing!: boolean | null;
  @readonly @date('updated_at') updatedAt!: Date;
}
