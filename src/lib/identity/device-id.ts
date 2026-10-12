import * as Crypto from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';

const KEY = 'identity.deviceId';

/** Stable per-install id used as the author of records until accounts exist. */
export function getDeviceId(): string {
  const existing = Storage.getItemSync(KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  Storage.setItemSync(KEY, id);
  return id;
}
