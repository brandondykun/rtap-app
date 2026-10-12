import { Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

/** Local-only: when this device last opened a mission and where its camera was. */
export class MissionViewState extends Model {
  static table = Tables.missionViewState;

  @field('mission_id') missionId!: string;
  @field('last_opened_at') lastOpenedAt!: number;
  /** JSON `MissionCamera` or null. */
  @field('camera') camera!: string | null;
  @readonly @date('updated_at') updatedAt!: Date;
}
