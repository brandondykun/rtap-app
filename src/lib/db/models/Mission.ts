import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

export class Mission extends Model {
  static table = Tables.missions;

  @text('name') name!: string;
  @field('created_by') createdBy!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
