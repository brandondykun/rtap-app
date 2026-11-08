import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { normalizeCallsign } from '@/lib/identity/callsign';

type ProfileValues = {
  /**
   * The name this user goes by; null until chosen. Kept on this phone only: records are stamped with ids, never the
   * callsign, so a later rename shows everywhere once teams share missions.
   */
  callsign: string | null;
  /** The first-launch "choose a callsign" card was answered (saved or Later); it never shows again. */
  callsignPrompted: boolean;
  /** Get started was tapped on the first-launch landing screen; the app opens on the missions from then on. */
  landingSeen: boolean;
};

type ProfileActions = {
  /** Saves the callsign normalized; an empty one clears it. Returns false (and changes nothing) when invalid. */
  setCallsign: (raw: string) => boolean;
  dismissCallsignPrompt: () => void;
  /** No callsign, not yet asked (the development Reset callsign button); the landing screen stays seen. */
  resetProfile: () => void;
  markLandingSeen: () => void;
  /** Shows the landing screen again on the next visit to the missions (the development Landing button). */
  resetLanding: () => void;
};

export type ProfileState = ProfileValues & ProfileActions;

export const DEFAULT_PROFILE: ProfileValues = { callsign: null, callsignPrompted: false, landingSeen: false };

const syncStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => void Storage.removeItemSync(key),
};

/** Validates persisted values field by field; anything invalid keeps the current value. */
function mergePersisted(persisted: unknown, current: ProfileState): ProfileState {
  const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
  const callsign = typeof p.callsign === 'string' ? normalizeCallsign(p.callsign) : null;
  return {
    ...current,
    callsign: p.callsign === null || callsign === p.callsign ? (p.callsign as string | null) : current.callsign,
    callsignPrompted: typeof p.callsignPrompted === 'boolean' ? p.callsignPrompted : current.callsignPrompted,
    landingSeen: typeof p.landingSeen === 'boolean' ? p.landingSeen : current.landingSeen,
  };
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      ...DEFAULT_PROFILE,
      setCallsign: (raw) => {
        if (raw.trim() === '') {
          set({ callsign: null, callsignPrompted: true });
          return true;
        }
        const callsign = normalizeCallsign(raw);
        if (callsign === null) return false;
        set({ callsign, callsignPrompted: true });
        return true;
      },
      dismissCallsignPrompt: () => set({ callsignPrompted: true }),
      resetProfile: () => set({ callsign: DEFAULT_PROFILE.callsign, callsignPrompted: DEFAULT_PROFILE.callsignPrompted }),
      markLandingSeen: () => set({ landingSeen: true }),
      resetLanding: () => set({ landingSeen: false }),
    }),
    {
      name: 'profile',
      version: 1,
      storage: createJSONStorage(() => syncStorage),
      merge: mergePersisted,
      partialize: ({ callsign, callsignPrompted, landingSeen }) => ({ callsign, callsignPrompted, landingSeen }),
    },
  ),
);
