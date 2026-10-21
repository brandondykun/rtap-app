import type { MapView } from '@rnmapbox/maps';
import { type RefObject, useEffect } from 'react';

import type { LatLon } from '@/lib/geo/types';
import { useOp } from '@/stores/op';

import { setFreeCamera } from './free-camera';

/** How often the ground under the OP is re-read, as terrain tiles load in. */
export const OP_GROUND_REFRESH_MS = 1000;

/** After staking, the ground is read again this soon: the 3D exaggeration only reaches the terrain after a render. */
export const OP_FIRST_REFRESH_MS = 150;

/**
 * While standing at an OP, places the camera at the eye (ground plus eye height) looking along
 * the OP's bearing and pitch. Subscribes to the store directly so swipes never re-render the map.
 */
export function useOpCamera(mapRef: RefObject<MapView | null>): void {
  useEffect(() => {
    let frame: number | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let first: ReturnType<typeof setTimeout> | null = null;

    const place = () => {
      const { at, groundM, eyeM, pitch, bearing } = useOp.getState();
      if (useOp.getState().phase !== 'on' || !at || groundM === null) return;
      setFreeCamera(mapRef.current, { at, altitudeM: groundM + eyeM, pitch, bearing });
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        place();
      });
    };

    // The raw drawn ground (not divided by the exaggeration): the camera sits in the drawn world.
    const readGround = async (at: LatLon) => {
      let m: number | null = null;
      try {
        m = (await mapRef.current?.queryTerrainElevation([at.lon, at.lat])) ?? null;
      } catch {
        m = null;
      }
      const s = useOp.getState();
      if (s.phase !== 'on' || s.at !== at) return; // exited or re-staked while reading
      if (m === null || !Number.isFinite(m)) {
        // No tile under the OP (yet): assume 0 only until a first ground is found, then keep the last good one.
        if (s.groundM === null) s.setGround(0);
        return;
      }
      if (m !== s.groundM) s.setGround(m);
    };

    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      if (timer !== null) clearInterval(timer);
      timer = null;
      if (first !== null) clearTimeout(first);
      first = null;
    };

    const begin = (at: LatLon) => {
      stop();
      void readGround(at);
      first = setTimeout(() => void readGround(at), OP_FIRST_REFRESH_MS);
      timer = setInterval(() => void readGround(at), OP_GROUND_REFRESH_MS);
    };

    if (useOp.getState().phase === 'on' && useOp.getState().at) begin(useOp.getState().at!);

    const unsubscribe = useOp.subscribe((s, prev) => {
      if (s.phase !== 'on') {
        stop();
        return;
      }
      if (prev.phase !== 'on' || s.at !== prev.at) begin(s.at!);
      if (
        s.groundM !== prev.groundM ||
        s.eyeM !== prev.eyeM ||
        s.pitch !== prev.pitch ||
        s.bearing !== prev.bearing
      ) {
        schedule();
      }
    });

    return () => {
      unsubscribe();
      stop();
    };
  }, [mapRef]);
}
