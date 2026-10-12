import { Database, type DatabaseAdapter } from '@nozbe/watermelondb';

import { installUuidGenerator } from './ids';
import { ItemViewState } from './models/ItemViewState';
import { MapItem } from './models/MapItem';
import { Mission } from './models/Mission';
import { MissionViewState } from './models/MissionViewState';

export function createDatabase(adapter: DatabaseAdapter): Database {
  installUuidGenerator();
  return new Database({ adapter, modelClasses: [Mission, MissionViewState, MapItem, ItemViewState] });
}
