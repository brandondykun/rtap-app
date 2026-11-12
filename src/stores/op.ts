import { create } from 'zustand';

import type { LatLon } from '@/lib/geo/types';

/** OP mode: off, waiting for the user to pick a spot, or standing at an OP. */
export type OpPhase = 'off' | 'picking' | 'on';

export type OpValues = {
  phase: OpPhase;
  at: LatLon | null;
  groundM: number | null;
  eyeM: number;
  bearing: number;
  pitch: number;
};

type OpActions = {
  startPicking: () => void;
  cancel: () => void;
  stake: (at: LatLon, bearing: number) => void;
  setGround: (m: number) => void;
  look: (dBearing: number, dPitch: number) => void;
  setEye: (m: number) => void;
  exit: () => void;
};

export const INITIAL_OP: OpValues = {
  phase: 'off',
  at: null,
  groundM: null,
  eyeM: 10,
  bearing: 0,
  pitch: 80,
};

export const OP_EYE_RANGE = [5, 250] as const;
export const OP_MAX_PITCH = 85;

const ENTRY_PITCH = 80;

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));
const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;

/** The observation post: picking a spot, standing on it, and looking out from it. Lives only in memory. */
export const useOp = create<OpValues & OpActions>()((set) => ({
  ...INITIAL_OP,
  startPicking: () => set({ phase: 'picking' }),
  cancel: () => set((s) => (s.phase === 'picking' ? { phase: 'off' } : {})),
  stake: (at, bearing) =>
    set({ phase: 'on', at, bearing, pitch: ENTRY_PITCH, groundM: null }),
  setGround: (m) => {
    if (Number.isFinite(m)) set({ groundM: m });
  },
  look: (dBearing, dPitch) => {
    if (!Number.isFinite(dBearing) || !Number.isFinite(dPitch)) return;
    set((s) => ({
      bearing: wrap360(s.bearing + dBearing),
      pitch: clamp(s.pitch + dPitch, [0, OP_MAX_PITCH]),
    }));
  },
  setEye: (m) => {
    if (Number.isFinite(m)) set({ eyeM: clamp(m, OP_EYE_RANGE) });
  },
  exit: () => set((s) => ({ ...INITIAL_OP, eyeM: s.eyeM })),
}));
