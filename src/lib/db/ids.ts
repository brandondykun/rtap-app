import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId';
import * as Crypto from 'expo-crypto';

/** Record ids are UUIDv4 so a future server can accept client-created records as-is. */
export function installUuidGenerator(): void {
  setGenerator(() => Crypto.randomUUID());
}
