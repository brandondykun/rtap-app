import { Camera, Images, MapView, RasterDemSource, Terrain, type MapState } from '@rnmapbox/maps';
import { useEffect, useMemo, useState, type ReactNode, type Ref } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { notifyInfo } from '@/features/feedback/feedback';
import type { MissionCamera } from '@/features/missions/repository';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import type { LatLon } from '@/lib/geo/types';
import { wrapLon } from '@/lib/geo/units/angle';
import { useInteraction } from '@/stores/interaction';
import { useSettings, type Basemap } from '@/stores/settings';

import { MAP_IMAGES } from '../images/map-images';
import { ornamentPositions, type Insets } from '../layout';
import { cameraFromMapState, toCameraStop } from './camera';
import { createLatestThrottle } from './frame-throttle';
import { BASEMAP_LABELS, BASEMAP_STYLE_URLS } from './mapbox';

/** The pressed position from a Mapbox press feature; null when not finite. */
function pressCoord(geometry: unknown): LatLon | null {
  const [lon, lat] = (geometry as { coordinates: number[] }).coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon: lon >= -180 && lon < 180 ? lon : wrapLon(lon) };
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const TERRAIN_SOURCE_ID = 'terrain-dem';

type Props = {
  cameraRef: Ref<Camera>;
  /** The map view, for pictures of the mission (see mission-snapshot). */
  mapRef?: Ref<MapView>;
  /** Applied once at mount (uncontrolled camera); later moves go through cameraRef. */
  initialCamera: MissionCamera;
  onCameraIdle: (camera: MissionCamera) => void;
  /** Called while the user drags/pinches the map (turns follow mode off). */
  onUserGesture: () => void;
  /** A long press on the map at this coordinate. */
  onLongPress?: (coord: LatLon) => void;
  /** A tap on the map (not on a point). */
  onPress?: (coord: LatLon) => void;
  landscape: boolean;
  panel: PanelFrame | null;
  /** Runtime symbol images by SIDC (useSymbolImages) and the request for one the map reports missing. */
  symbolImages: Record<string, { url: string; scale: number }>;
  onSymbolMissing: (sidc: string) => void;
  children?: ReactNode;
};

export function MapCanvas({ cameraRef, mapRef, initialCamera, onCameraIdle, onUserGesture, onLongPress, onPress, landscape, panel, symbolImages, onSymbolMissing, children }: Props) {
  const basemap = useSettings((s) => s.basemap);
  // If the chosen style can't load (e.g. offline with only Satellite cached), use Satellite for
  // this session so points and the self icon still render. Choosing a basemap again retries it.
  const [failedBasemap, setFailedBasemap] = useState<Basemap | null>(null);
  // A new choice clears the failure, so picking that basemap again later retries it.
  const [chosen, setChosen] = useState(basemap);
  if (chosen !== basemap) {
    setChosen(basemap);
    setFailedBasemap(null);
  }
  const effectiveBasemap = failedBasemap === basemap ? 'satellite' : basemap;
  const onMapLoadingError = (payload?: { type?: string }) => {
    if (payload?.type !== 'style' || basemap === 'satellite' || failedBasemap === basemap) return;
    setFailedBasemap(basemap);
    notifyInfo(`${BASEMAP_LABELS[basemap]} map is unavailable — showing Satellite.`);
  };
  const insets = useSafeAreaInsets();
  const toolbar = useToolbarHeight();
  // Mapbox on iOS measures ornament margins from the safe area already.
  // A left drawer covers the top-left corner; keep the logo row visible right of it. The drawer
  // width counts from the screen edge, the ornament margin from the safe area: subtract the inset.
  const leftOffset = panel?.side === 'left' ? Math.max(0, panel.size - insets.left) : 0;
  const ornaments = ornamentPositions({
    landscape,
    insets: Platform.OS === 'ios' ? NO_INSETS : insets,
    leftOffset,
    toolbarHeight: toolbar,
  });
  const publishCamera = useMemo(() => createLatestThrottle(useInteraction.getState().setCamera), []);

  useEffect(() => {
    // The readout must never be blank: start from the camera the map opens at.
    useInteraction.getState().setCamera(initialCamera);
  }, [initialCamera]);

  const onCameraChanged = (state: MapState) => {
    const camera = cameraFromMapState(state);
    if (camera) publishCamera(camera);
    if (state.gestures.isGestureActive) onUserGesture();
  };

  const onMapIdle = (state: MapState) => {
    const camera = cameraFromMapState(state);
    if (camera) onCameraIdle(camera);
  };

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      styleURL={BASEMAP_STYLE_URLS[effectiveBasemap]}
      onMapLoadingError={onMapLoadingError}
      compassEnabled={false}
      pitchEnabled={false}
      scaleBarEnabled={false}
      logoPosition={ornaments.logo}
      attributionPosition={ornaments.attribution}
      onCameraChanged={onCameraChanged}
      onMapIdle={onMapIdle}
      onPress={(feature) => {
        const coord = pressCoord(feature.geometry);
        if (coord) onPress?.(coord);
      }}
      onLongPress={(feature) => {
        const coord = pressCoord(feature.geometry);
        if (coord) onLongPress?.(coord);
      }}>
      <Camera ref={cameraRef} defaultSettings={toCameraStop(initialCamera)} />
      <Images images={MAP_IMAGES} />
      <Images images={symbolImages} onImageMissing={onSymbolMissing} />
      {/* Ground elevation for units (queryTerrainElevation). Its answers scale with the exaggeration, so it
          stays at true scale; with pitch off the map still looks flat. */}
      <RasterDemSource id={TERRAIN_SOURCE_ID} url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={514} maxZoomLevel={14} />
      <Terrain sourceID={TERRAIN_SOURCE_ID} style={{ exaggeration: 1 }} />
      {children}
    </MapView>
  );
}
