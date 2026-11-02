import { Atmosphere, Camera, Images, MapView, RasterDemSource, Terrain, type MapState } from '@rnmapbox/maps';
import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { notifyInfo } from '@/features/feedback/feedback';
import type { MissionCamera } from '@/features/missions/repository';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import type { LatLon } from '@/lib/geo/types';
import { wrapLon } from '@/lib/geo/units/angle';
import { useInteraction, type ViewBounds } from '@/stores/interaction';
import { useOp } from '@/stores/op';
import { useSettings, type Basemap } from '@/stores/settings';

import { MAP_IMAGES } from '../images/map-images';
import { ornamentPositions, type Insets } from '../layout';
import { needsNewGrid } from '../layers/mgrs-grid';
import { terrainExaggeration, THREE_D_PITCH } from '../terrain/three-d';
import { cameraFromMapState, MIN_ZOOM, toCameraStop, viewFromMapState } from './camera';
import { createLatestThrottle } from './frame-throttle';
import { BASEMAP_LABELS, BASEMAP_STYLE_URLS } from './mapbox';

/** The pressed position from a Mapbox press feature; null when not finite. */
function pressCoord(geometry: unknown): LatLon | null {
  const [lon, lat] = (geometry as { coordinates: number[] }).coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon: lon >= -180 && lon < 180 ? lon : wrapLon(lon) };
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Moves the MGRS grid on to `view` if the grid is shown and the lines it has drawn no longer serve it. */
function refreshGridView(view: ViewBounds) {
  const { showMgrsGrid, showGrid100m } = useSettings.getState();
  const { gridView, setGridView } = useInteraction.getState();
  if (showMgrsGrid && needsNewGrid(gridView, view, showGrid100m ? 100 : 1_000)) setGridView(view);
}
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
  const threeD = useSettings((s) => s.terrain3d);
  // Subscribed, so a new height from Settings reshapes the terrain at once.
  const terrainHeight = useSettings((s) => s.terrainExaggeration);
  const terrainIn2d = useSettings((s) => s.terrainIn2d);
  // In OP mode the map is fixed (the camera is placed by the OP) and looking is done with OpGestures.
  const inOp = useOp((s) => s.phase === 'on');
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
    android: Platform.OS === 'android',
  });
  const publishCamera = useMemo(() => createLatestThrottle(useInteraction.getState().setCamera), []);
  const checkGridView = useMemo(() => createLatestThrottle(refreshGridView), []);
  // The latest view, so the grid can be drawn the moment it is switched on.
  const latestView = useRef<ViewBounds | null>(null);
  const showGrid = useSettings((s) => s.showMgrsGrid);

  useEffect(() => {
    if (showGrid && latestView.current) refreshGridView(latestView.current);
  }, [showGrid]);

  useEffect(() => {
    // The readout must never be blank: start from the camera the map opens at.
    useInteraction.getState().setCamera(initialCamera);
  }, [initialCamera]);

  const onCameraChanged = (state: MapState) => {
    const camera = cameraFromMapState(state);
    if (camera) publishCamera(camera);
    // Checked during gestures too, so new grid lines are drawn before they scroll into view.
    const view = viewFromMapState(state);
    latestView.current = view ?? latestView.current;
    if (view && useSettings.getState().showMgrsGrid) checkGridView(view);
    if (state.gestures.isGestureActive) onUserGesture();
  };

  const onMapIdle = (state: MapState) => {
    const camera = cameraFromMapState(state);
    if (camera) onCameraIdle(camera);
    const view = viewFromMapState(state);
    latestView.current = view ?? latestView.current;
    if (view) refreshGridView(view);
  };

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      styleURL={BASEMAP_STYLE_URLS[effectiveBasemap]}
      onMapLoadingError={onMapLoadingError}
      compassEnabled={false}
      scrollEnabled={!inOp}
      zoomEnabled={!inOp}
      rotateEnabled={!inOp}
      pitchEnabled={threeD && !inOp}
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
      <Camera ref={cameraRef} defaultSettings={{ ...toCameraStop(initialCamera), pitch: threeD ? THREE_D_PITCH : 0 }} minZoomLevel={MIN_ZOOM} />
      <Images images={MAP_IMAGES} />
      <Images images={symbolImages} onImageMissing={onSymbolMissing} />
      {/* Ground elevation for units (queryTerrainElevation, which undoes the exaggeration) and the 3D view.
          Flat, it stays at true scale and the map looks flat; in 3D it is raised so hills read. */}
      <RasterDemSource id={TERRAIN_SOURCE_ID} url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={514} maxZoomLevel={14} />
      <Terrain sourceID={TERRAIN_SOURCE_ID} style={{ exaggeration: terrainExaggeration(threeD, terrainHeight, terrainIn2d) }} />
      {threeD ? <Atmosphere style={{ range: inOp ? [2, 20] : [0.8, 8], horizonBlend: 0.1 }} /> : null}
      {children}
    </MapView>
  );
}
