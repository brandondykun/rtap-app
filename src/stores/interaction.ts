import { create } from 'zustand';

import type { LatLon } from '@/lib/geo/types';

export type CameraSnapshot = { center: LatLon; zoom: number; bearing: number };
/** The map's bounds and zoom. */
export type ViewBounds = { sw: LatLon; ne: LatLon; zoom: number };

type InteractionValues = {
  /** Map center under the crosshair; fed (throttled) by MapCanvas. Null until the map mounts. */
  cameraCenter: LatLon | null;
  cameraZoom: number;
  /** Map bearing in degrees clockwise from true north (drives the north-up needle). */
  cameraBearing: number;
  /** Camera follows the user's position until the user pans. */
  followMode: boolean;
  /** The view the MGRS grid is drawn for; MapCanvas moves it on only when the grid needs redrawing. Null until then. */
  gridView: ViewBounds | null;
};

type InteractionActions = {
  setCamera: (camera: CameraSnapshot) => void;
  setFollowMode: (on: boolean) => void;
  setGridView: (view: ViewBounds) => void;
  reset: () => void;
};

export const INITIAL_INTERACTION: InteractionValues = {
  cameraCenter: null,
  cameraZoom: 0,
  cameraBearing: 0,
  followMode: false,
  gridView: null,
};

export const useInteraction = create<InteractionValues & InteractionActions>()((set) => ({
  ...INITIAL_INTERACTION,
  setCamera: (camera) => set({ cameraCenter: camera.center, cameraZoom: camera.zoom, cameraBearing: camera.bearing }),
  setFollowMode: (followMode) => set({ followMode }),
  setGridView: (gridView) => set({ gridView }),
  reset: () => set(INITIAL_INTERACTION),
}));
