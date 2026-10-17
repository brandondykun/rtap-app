import type { Camera, CameraStop } from '@rnmapbox/maps';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { Toast } from '@/components/ui/Toast';
import { notifyPlaced, notifySelected } from '@/features/feedback/feedback';
import { useSelfLocation } from '@/features/location/use-self-location';
import { openItemMenu } from '@/features/map-items/menus/item-menus';
import { MeasureBar } from '@/features/measure/MeasureBar';
import type { MissionCamera } from '@/features/missions/repository';
import { MenuHost } from '@/features/menus/MenuHost';
import { QuickPlotCard } from '@/features/quick-plot/QuickPlotCard';
import { QuickPlotEntry } from '@/features/quick-plot/QuickPlotEntry';
import type { ItemRef } from '@/features/symbology/categories';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { LatLon } from '@/lib/geo/types';
import { useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { useMeasure } from '@/stores/measure';
import { useQuickPlot } from '@/stores/quick-plot';
import { useMenu, topMenu } from '@/stores/menu';
import { usePlacing, type PlacingCategory } from '@/stores/placing';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';

import { clampZoom, fitBounds, SELF_ZOOM, WORLD_CAMERA } from './canvas/camera';
import { useCameraPersistence } from './canvas/camera-persistence';
import { MapCanvas } from './canvas/MapCanvas';
import { MapBottomLeft } from './controls/MapBottomLeft';
import { LineDrawBar } from './controls/LineDrawBar';
import { MapControls } from './controls/MapControls';
import { MapTopLeft } from './controls/MapTopLeft';
import { PlaceBar } from './controls/PlaceBar';
import { Crosshair } from './interaction/Crosshair';
import { DraftLayer } from './layers/DraftLayer';
import { DraftLineLayer } from './layers/DraftLineLayer';
import { DraftPolygonLayer } from './layers/DraftPolygonLayer';
import { LinesLayer } from './layers/LinesLayer';
import { MeasureLayer } from './layers/MeasureLayer';
import { QuickPlotLayer } from './layers/QuickPlotLayer';
import { PointsLayer } from './layers/PointsLayer';
import { PolygonsLayer } from './layers/PolygonsLayer';
import { SelfLayer } from './layers/SelfLayer';
import { cameraPaddingFor, EDGE, GAP, isLandscape } from './layout';

const EASE = { animationMode: 'easeTo' as const };
/** ~5 m: the idle camera center counts as the move's target. */
const ARRIVED_DEG = 5e-5;

/** The camera reached a line fit once its center is inside the fitted bounds. */
function isInside(p: LatLon, b: { sw: LatLon; ne: LatLon }) {
  return p.lat >= b.sw.lat && p.lat <= b.ne.lat && p.lon >= b.sw.lon && p.lon <= b.ne.lon;
}

function isNear(a: LatLon, b: LatLon) {
  return Math.abs(a.lat - b.lat) < ARRIVED_DEG && Math.abs(a.lon - b.lon) < ARRIVED_DEG / Math.max(Math.cos((b.lat * Math.PI) / 180), 0.01);
}

export function MissionMap({ missionId, savedCamera }: { missionId: string; savedCamera: MissionCamera | null }) {
  const ctx = useCommandContext();
  const { width, height } = useWindowDimensions();
  const landscape = isLandscape(width, height);
  const toolbar = useToolbarHeight();
  const labelsOn = useSettings((s) => s.showMapLabels);
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<Camera>(null);
  const [initialCamera] = useState(() => savedCamera ?? WORLD_CAMERA);
  // With a saved camera the map opens where the user left it; otherwise the first fix centers it.
  const centeredOnSelf = useRef(savedCamera !== null);
  const followMode = useInteraction((s) => s.followMode);
  const setFollowMode = useInteraction((s) => s.setFollowMode);
  // Boolean selector: a GPS fix must not re-render the map tree; fixes are handled in a store subscription.
  const hasSelfPosition = usePresence((s) => s.selfPosition !== null);
  // Only a camera the app or user actually moved is worth persisting (not the untouched open).
  const cameraMoved = useRef(false);
  // Backgrounded between a gesture and map idle: fall back to the latest live camera.
  const liveCamera = useCallback(() => {
    if (!cameraMoved.current) return null;
    const { cameraCenter, cameraZoom, cameraBearing } = useInteraction.getState();
    return cameraCenter ? { center: cameraCenter, zoom: cameraZoom, bearing: cameraBearing } : null;
  }, []);
  const saver = useCameraPersistence(ctx, missionId, liveCamera);
  const markMoved = useCallback(() => {
    cameraMoved.current = true;
    saver.touch();
  }, [saver]);
  useSelfLocation();
  const panel = useMenu((s) => s.panelFrame);
  const topId = useMenu((s) => topMenu(s)?.id ?? null);
  const editingId = useDraft((s) => (s.mode === 'edit' ? s.itemId : null));
  const drawingLine = useDraft((s) => s.mode !== null && s.category === 'line');
  const draftActive = useDraft((s) => s.mode !== null);
  const measuring = useMeasure((s) => s.active);
  const plotEntryOpen = useQuickPlot((s) => s.entryOpen);
  const plotTemp = useQuickPlot((s) => s.temp);
  const quickPlotting = plotEntryOpen || plotTemp !== null;
  const placing = usePlacing((s) => s.category);
  const lineDrawing = useDraft((s) => (s.category === 'line' || s.category === 'polygon') && s.mode !== null && !s.locked);
  const drawingPolygon = useDraft((s) => s.mode !== null && s.category === 'polygon');
  // A draft-follow move still in flight: a padding change must complete it, not cancel it.
  const followTarget = useRef<LatLon | null>(null);
  // A line fit still in flight: a padding change re-issues it instead of cancelling it.
  const fitTarget = useRef<{ sw: LatLon; ne: LatLon } | null>(null);
  // Every camera move carries the panel's full padding: a move without it targets the padding of the
  // moment (possibly mid-animation) and replaces the running padding ease (rnmapbox 10 iOS).
  const moveCamera = useCallback((stop: Omit<CameraStop, 'padding'>) => {
    cameraRef.current?.setCamera({ ...stop, padding: cameraPaddingFor(useMenu.getState().panelFrame) });
  }, []);
  // Fit a line into the map area the panel leaves visible, as a padded center + zoom move.
  const fitCamera = useCallback(
    (bounds: { sw: LatLon; ne: LatLon }, animationDuration: number) => {
      const window = Dimensions.get('window');
      const pad = cameraPaddingFor(useMenu.getState().panelFrame);
      const visible = { width: window.width - pad.paddingLeft - pad.paddingRight, height: window.height - pad.paddingTop - pad.paddingBottom };
      const { center, zoom } = fitBounds(bounds, visible);
      moveCamera({ centerCoordinate: [center.lon, center.lat], zoomLevel: zoom, ...EASE, animationDuration });
    },
    [moveCamera],
  );
  // Pad the camera only when the panel frame changes (not on mount).
  const appliedPanel = useRef<PanelFrame | null>(null);
  useEffect(() => {
    if (panel === appliedPanel.current) return;
    appliedPanel.current = panel;
    // Following the user: re-center on them now rather than at the next GPS fix.
    const self = useInteraction.getState().followMode ? (usePresence.getState().selfPosition?.position ?? null) : null;
    const fit = fitTarget.current;
    if (fit) {
      fitCamera(fit, 250);
      return;
    }
    const target = followTarget.current ?? self;
    moveCamera({ ...(target ? { centerCoordinate: [target.lon, target.lat] } : {}), ...EASE, animationDuration: 250 });
  }, [panel, moveCamera, fitCamera]);

  useEffect(() => () => useInteraction.getState().reset(), []);
  useEffect(
    () => () => {
      useMenu.getState().closeMenu();
      useMenu.getState().setPanelFrame(null);
    },
    [],
  );

  useEffect(() => {
    const onFix = ({ lat, lon }: LatLon) => {
      const centerCoordinate: [number, number] = [lon, lat];
      if (!centeredOnSelf.current) {
        centeredOnSelf.current = true;
        markMoved();
        moveCamera({ centerCoordinate, zoomLevel: SELF_ZOOM, animationDuration: 0 });
      } else if (useInteraction.getState().followMode) {
        moveCamera({ centerCoordinate, ...EASE, animationDuration: 500 });
      }
    };
    const current = usePresence.getState().selfPosition;
    if (current) onFix(current.position);
    return usePresence.subscribe((state, prev) => {
      if (state.selfPosition && state.selfPosition !== prev.selfPosition) onFix(state.selfPosition.position);
    });
  }, [markMoved, moveCamera]);

  // The map follows the draft when typing, Me, a long-press or an item moves it — never for Center
  // (already under the crosshair) and never when the user pans (the draft stays put).
  useEffect(
    () =>
      useDraft.subscribe((state, prev) => {
        if (state.coordRev === prev.coordRev || !state.coord || state.coordSource === 'crosshair' || state.coordSource === 'draw') return;
        markMoved();
        if (useInteraction.getState().followMode) setFollowMode(false);
        followTarget.current = state.coord;
        fitTarget.current = null;
        moveCamera({ centerCoordinate: [state.coord.lon, state.coord.lat], ...EASE, animationDuration: 400 });
      }),
    [markMoved, setFollowMode, moveCamera],
  );

  // Opening a saved line fits the camera to it.
  useEffect(
    () =>
      useDraft.subscribe((state, prev) => {
        if (state.focusRev === prev.focusRev || !state.focusBounds) return;
        markMoved();
        if (useInteraction.getState().followMode) setFollowMode(false);
        followTarget.current = null;
        fitTarget.current = state.focusBounds;
        fitCamera(state.focusBounds, 500);
      }),
    [markMoved, setFollowMode, fitCamera],
  );

  // Any menu opening (a tool, Menu, Settings, a Layers row…) ends measuring, placing and quick plot.
  useEffect(
    () =>
      useMenu.subscribe((state, prev) => {
        if (state.stack.length === 0 || state.stack === prev.stack) return;
        if (useMeasure.getState().active) useMeasure.getState().stopMeasure();
        if (usePlacing.getState().category) usePlacing.getState().stop();
        const q = useQuickPlot.getState();
        if (q.entryOpen || q.temp) q.close();
      }),
    [],
  );
  useEffect(
    () => () => {
      useMeasure.getState().stopMeasure();
      useQuickPlot.getState().close();
      usePlacing.getState().stop();
    },
    [],
  );
  const toggleMeasure = () => {
    if (useMeasure.getState().active) useMeasure.getState().stopMeasure();
    else {
      useMenu.getState().closeMenu();
      useQuickPlot.getState().close();
      usePlacing.getState().stop();
      useMeasure.getState().startMeasure();
    }
  };

  const toggleQuickPlot = () => {
    const q = useQuickPlot.getState();
    if (q.entryOpen || q.temp) q.close();
    else {
      useMenu.getState().closeMenu();
      useMeasure.getState().stopMeasure();
      usePlacing.getState().stop();
      q.open();
    }
  };
  // A new temporary point: ease the map to it (the bottom card leaves the center clear).
  useEffect(
    () =>
      useQuickPlot.subscribe((state, prev) => {
        if (!state.temp || state.temp === prev.temp) return;
        markMoved();
        if (useInteraction.getState().followMode) setFollowMode(false);
        followTarget.current = state.temp;
        moveCamera({ centerCoordinate: [state.temp.lon, state.temp.lat], ...EASE, animationDuration: 400 });
      }),
    [markMoved, setFollowMode, moveCamera],
  );

  const toggleLayers = () => {
    if (topId === 'layers') useMenu.getState().closeMenu();
    else useMenu.getState().openMenu('layers', {});
  };
  const toggleAdd = (id: 'line.add' | 'polygon.add') => {
    if (topId === id) useMenu.getState().closeMenu();
    else if (id === 'line.add') useMenu.getState().openMenu('line.add', {});
    else useMenu.getState().openMenu('polygon.add', {});
  };
  // UNIT / POINT wait for a map tap (or Add at center) before their Add menu opens.
  const togglePlacing = (category: PlacingCategory) => {
    const p = usePlacing.getState();
    if (topId === `${category}.add` || p.category === category) {
      useMenu.getState().closeMenu();
      p.stop();
      return;
    }
    useMenu.getState().closeMenu();
    useMeasure.getState().stopMeasure();
    useQuickPlot.getState().close();
    p.start(category);
  };
  /** Opens the Add menu being placed, at `at` or (no `at`) at the crosshair; opening it ends placing. */
  const placeAt = (category: PlacingCategory, at?: LatLon) => {
    const params = at ? { at } : {};
    if (category === 'unit') useMenu.getState().openMenu('unit.add', params);
    else useMenu.getState().openMenu('point.add', params);
  };
  const isDrawing = () => {
    const d = useDraft.getState();
    return (d.category === 'line' || d.category === 'polygon') && d.mode !== null && !d.locked;
  };
  /** While a line or polygon is being drawn, map taps (and long-presses, and taps on symbols) go to it. */
  const placeDraftPoint = (at: LatLon) => {
    const d = useDraft.getState();
    if (d.category === 'polygon' && d.polygonShape === 'circle') {
      // The Map button (picking) moves the center; otherwise the first tap sets it and later taps the edge.
      if (d.coord === null || d.picking) d.setCoord(at, 'draw');
      else d.setCircleEdge(at);
    } else if (d.selectedVertex !== null && d.insertAfter === null) d.moveVertex(d.selectedVertex, at);
    else d.addVertex(at);
  };
  // Map button: the next tap on the map (or on a point) places the draft there.
  const onMapPress = (coord: LatLon) => {
    if (useQuickPlot.getState().entryOpen) {
      Keyboard.dismiss();
      useQuickPlot.getState().close();
      return;
    }
    const placingCategory = usePlacing.getState().category;
    if (useMeasure.getState().active) useMeasure.getState().place(coord);
    else if (placingCategory) placeAt(placingCategory, coord);
    else if (isDrawing()) placeDraftPoint(coord);
    else if (useDraft.getState().picking) useDraft.getState().setCoord(coord, 'press');
  };
  const onItemPress = (itemId: string, at: LatLon, item: ItemRef, itemAt?: LatLon | null) => {
    // Measuring snaps to the symbol itself (lines pass no itemAt: the tap point is used).
    const placingCategory = usePlacing.getState().category;
    if (useMeasure.getState().active) useMeasure.getState().place(itemAt ?? at);
    else if (placingCategory) placeAt(placingCategory, at);
    else if (isDrawing()) placeDraftPoint(at);
    else if (useDraft.getState().picking) useDraft.getState().setCoord(at, 'press');
    else {
      notifySelected();
      openItemMenu(itemId, item);
    }
  };
  const onLongPress = (coord: LatLon) => {
    if (useMeasure.getState().active) return;
    notifyPlaced();
    if (isDrawing()) {
      placeDraftPoint(coord);
      return;
    }
    const current = topMenu(useMenu.getState())?.id;
    // A unit being added or edited moves there; otherwise long-press always adds an enemy unit (never a point).
    const movingUnit = current === 'unit.add' || (current === 'unit.edit' && !useDraft.getState().locked);
    if (movingUnit) useDraft.getState().setCoord(coord, 'press');
    else useMenu.getState().openMenu('unit.add', { at: coord, enemy: true });
  };

  const onUserGesture = () => {
    followTarget.current = null;
    fitTarget.current = null;
    markMoved();
    if (useInteraction.getState().followMode) setFollowMode(false);
  };
  const zoomBy = (delta: number) => {
    markMoved();
    const zoomLevel = clampZoom(useInteraction.getState().cameraZoom + delta);
    moveCamera({ zoomLevel, ...EASE, animationDuration: 250 });
  };
  const northUp = () => {
    markMoved();
    moveCamera({ heading: 0, ...EASE, animationDuration: 300 });
  };
  const recenter = () => {
    const self = usePresence.getState().selfPosition?.position;
    if (!self) return;
    markMoved();
    followTarget.current = null;
    fitTarget.current = null;
    setFollowMode(true);
    const zoomLevel = Math.max(useInteraction.getState().cameraZoom, SELF_ZOOM);
    moveCamera({ centerCoordinate: [self.lon, self.lat], zoomLevel, ...EASE, animationDuration: 500 });
  };

  return (
    <View className="flex-1 bg-surface">
      <MapCanvas
        cameraRef={cameraRef}
        initialCamera={initialCamera}
        landscape={landscape}
        panel={panel}
        onCameraIdle={(camera) => {
          // Only arriving ends a draft-follow move: an idle from an earlier move must not drop it.
          if (followTarget.current && isNear(camera.center, followTarget.current)) followTarget.current = null;
          if (fitTarget.current && isInside(camera.center, fitTarget.current)) fitTarget.current = null;
          if (cameraMoved.current) saver.schedule(camera);
        }}
        onLongPress={onLongPress}
        onPress={onMapPress}
        onUserGesture={onUserGesture}>
        <PolygonsLayer missionId={missionId} excludeId={editingId} onItemPress={onItemPress} />
        <LinesLayer missionId={missionId} excludeId={editingId} onItemPress={onItemPress} />
        <PointsLayer missionId={missionId} excludeId={editingId} onItemPress={onItemPress} />
        {draftActive ? <DraftLayer /> : null}
        {drawingLine ? <DraftLineLayer onVertexPress={(i) => useDraft.getState().selectVertex(i)} onPress={onMapPress} /> : null}
        {drawingPolygon ? <DraftPolygonLayer onVertexPress={(i) => useDraft.getState().selectVertex(i)} onPress={onMapPress} /> : null}
        {measuring ? <MeasureLayer /> : null}
        {plotTemp ? <QuickPlotLayer /> : null}
        <SelfLayer onPress={measuring ? (at) => useMeasure.getState().place(at) : undefined} />
      </MapCanvas>
      <Crosshair panel={panel} />
      <Toolbar
        landscape={landscape}
        activeTool={quickPlotting ? 'plot' : measuring ? 'measure' : placing ?? (topId === 'unit.add' ? 'unit' : topId === 'point.add' ? 'point' : topId === 'line.add' ? 'line' : topId === 'polygon.add' ? 'polygon' : topId === 'layers' ? 'layers' : null)}
        onUnit={() => togglePlacing('unit')}
        onPoint={() => togglePlacing('point')}
        onLine={() => toggleAdd('line.add')}
        onPolygon={() => toggleAdd('polygon.add')}
        onMeasure={toggleMeasure}
        onPlot={toggleQuickPlot}
        onLayers={toggleLayers}
        onMenu={() => useMenu.getState().openMenu('app.root', {})}
        onSettings={() => useMenu.getState().openMenu('settings', {})}
        labelsOn={labelsOn}
        onLabels={() => useSettings.getState().toggleMapLabels()}
      />
      <MapControls
        following={followMode}
        canRecenter={hasSelfPosition}
        onNorthUp={northUp}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onRecenter={recenter}
        panel={panel}
        landscape={landscape}
        bar={
          lineDrawing ? (
            <LineDrawBar />
          ) : placing ? (
            <PlaceBar onAtCenter={() => placeAt(placing)} onCancel={() => usePlacing.getState().stop()} />
          ) : measuring ? (
            <MeasureBar />
          ) : null
        }
      />
      {plotEntryOpen ? <QuickPlotEntry landscape={landscape} /> : null}
      {plotTemp && !plotEntryOpen ? <QuickPlotCard landscape={landscape} /> : null}
      {panel || plotTemp ? null : <MapBottomLeft landscape={landscape} />}
      <MapTopLeft landscape={landscape} panel={panel} />
      <MenuHost landscape={landscape} missionId={missionId} />
      <Toast top={insets.top + EDGE + toolbar + GAP} />
    </View>
  );
}
