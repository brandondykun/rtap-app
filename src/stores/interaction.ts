import { create } from 'zustand';

import type { LatLon } from '@/lib/geo/types';

export type CameraSnapshot = { center: LatLon; zoom: number; bearing: number };
/** The map's bounds and zoom when it last came to rest. */
export type RestingView = { sw: LatLon; ne: LatLon; zoom: number };

type InteractionValues = {
  /** Map center under the crosshair; fed (throttled) by MapCanvas. Null until the map mounts. */
  cameraCenter: LatLon | null;
  cameraZoom: number;
  /** Map bearing in degrees clockwise from true north (drives the north-up needle). */
  cameraBearing: number;
  /** Camera follows the user's position until the user pans. */
  followMode: boolean;
  /** Set by MapCanvas each time the map goes idle (the MGRS grid redraws from it); null until then. */
  restingView: RestingView | null;
};

type InteractionActions = {
  setCamera: (camera: CameraSnapshot) => void;
  setFollowMode: (on: boolean) => void;
  setRestingView: (view: RestingView) => void;
  reset: () => void;
};

export const INITIAL_INTERACTION: InteractionValues = {
  cameraCenter: null,
  cameraZoom: 0,
  cameraBearing: 0,
  followMode: false,
  restingView: null,
};

export const useInteraction = create<InteractionValues & InteractionActions>()((set) => ({
  ...INITIAL_INTERACTION,
  setCamera: (camera) => set({ cameraCenter: camera.center, cameraZoom: camera.zoom, cameraBearing: camera.bearing }),
  setFollowMode: (followMode) => set({ followMode }),
  setRestingView: (restingView) => set({ restingView }),
  reset: () => set(INITIAL_INTERACTION),
}));
