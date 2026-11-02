import type { Camera, CameraStop, MapView } from '@rnmapbox/maps';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Keyboard, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { Toast } from '@/components/ui/Toast';
import { notifyPlaced, notifySelected } from '@/features/feedback/feedback';
import { ManualLocationEntry } from '@/features/location/ManualLocationEntry';
import { useSelfLocation } from '@/features/location/use-self-location';
import { draftSidc } from '@/features/map-items/draft-sidc';
import { openItemMenu } from '@/features/map-items/menus/item-menus';
import { observeMissionSidcs } from '@/features/map-items/repository';
import { MeasureBar } from '@/features/measure/MeasureBar';
import type { MissionCamera } from '@/features/missions/repository';
import { MenuHost } from '@/features/menus/MenuHost';
import { QuickPlotCard } from '@/features/quick-plot/QuickPlotCard';
import { QuickPlotEntry } from '@/features/quick-plot/QuickPlotEntry';
import type { ItemRef } from '@/features/symbology/categories';
import { useSymbolImages } from '@/features/symbology/render/use-symbol-images';
import { MenuButton } from '@/components/menu/MenuButton';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { LatLon } from '@/lib/geo/types';
import { useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { useMeasure } from '@/stores/measure';
import { useOp } from '@/stores/op';
import { useManualEntry } from '@/stores/manual-entry';
import { useQuickPlot } from '@/stores/quick-plot';
import { useMenu, topMenu } from '@/stores/menu';
import { usePlacing, type PlacingCategory } from '@/stores/placing';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';

import { clampZoom, fitBounds, SELF_ZOOM, WORLD_CAMERA } from './canvas/camera';
import { useCameraPersistence } from './canvas/camera-persistence';
import { MapCanvas } from './canvas/MapCanvas';
import { useMissionSnapshot } from './canvas/mission-snapshot';
import { OpGestures } from './op/OpGestures';
import { useOpCamera } from './op/use-op-camera';
import { LineDrawBar } from './controls/LineDrawBar';
import { MapControls } from './controls/MapControls';
import { MapTopLeft } from './controls/MapTopLeft';
import { PlaceBar } from './controls/PlaceBar';
import { ManualPreviewLayer } from './layers/ManualPreviewLayer';
import { OpEyeSlider } from './op/OpEyeSlider';
import { Crosshair } from './interaction/Crosshair';
import { DraftLayer } from './layers/DraftLayer';
import { DraftLineLayer } from './layers/DraftLineLayer';
import { DraftPolygonLayer } from './layers/DraftPolygonLayer';
import { GridLayer } from './layers/GridLayer';
import { LinesLayer } from './layers/LinesLayer';
import { MeasureLayer } from './layers/MeasureLayer';
import { QuickPlotLayer } from './layers/QuickPlotLayer';
import { PointsLayer } from './layers/PointsLayer';
import { PolygonsLayer } from './layers/PolygonsLayer';
import { RingsLayer } from './layers/RingsLayer';
import { SelfLayer } from './layers/SelfLayer';
import { cameraPaddingFor, EDGE, GAP, isLandscape } from './layout';
import { useElevationSource } from './terrain/elevation';
import { THREE_D_PITCH, THREE_D_TILT_MS } from './terrain/three-d';

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

/** A map tap this soon after an item tap is the same touch reported twice, not a tap on a blank spot. */
const SAME_TOUCH_MS = 400;
const ITEM_VIEW_MENUS = new Set(['unit.edit', 'point.edit', 'line.edit', 'polygon.edit']);

/** An item's menu is open read-only (selected), not being edited. */
function isViewingItem(): boolean {
  const id = topMenu(useMenu.getState())?.id;
  return id !== undefined && ITEM_VIEW_MENUS.has(id) && useDraft.getState().locked;
}

export function MissionMap({ missionId, savedCamera }: { missionId: string; savedCamera: MissionCamera | null }) {
  const ctx = useCommandContext();
  const { width, height } = useWindowDimensions();
  const landscape = isLandscape(width, height);
  const toolbar = useToolbarHeight();
  const labelsOn = useSettings((s) => s.showMapLabels);
  const threeDOn = useSettings((s) => s.terrain3d);
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
    // Standing at an OP the live camera is the OP's eye, not the mission's view.
    if (!cameraMoved.current || useOp.getState().phase === 'on') return null;
    const { cameraCenter, cameraZoom, cameraBearing } = useInteraction.getState();
    return cameraCenter ? { center: cameraCenter, zoom: cameraZoom, bearing: cameraBearing } : null;
  }, []);
  const itemSidcs = useObservable(() => observeMissionSidcs(ctx.db, missionId), [] as string[], [ctx, missionId]);
  const draftSymbol = useDraft((s) => (s.mode && (s.category === 'unit' || s.category === 'point') ? draftSidc(s) : null));
  const symbolSidcs = useMemo(() => (draftSymbol && !itemSidcs.includes(draftSymbol) ? [...itemSidcs, draftSymbol] : itemSidcs), [itemSidcs, draftSymbol]);
  const symbols = useSymbolImages(symbolSidcs);
  const saver = useCameraPersistence(ctx, missionId, liveCamera);
  const mapRef = useRef<MapView>(null);
  useMissionSnapshot(ctx, missionId, mapRef);
  useOpCamera(mapRef);
  useElevationSource(mapRef);
  const markMoved = useCallback(() => {
    cameraMoved.current = true;
    saver.touch();
  }, [saver]);
  useSelfLocation();
  const panel = useMenu((s) => s.panelFrame);
  const topId = useMenu((s) => topMenu(s)?.id ?? null);
  // The menu the stack started from: Layers stays the open tool while an item drilled into from it shows.
  const rootId = useMenu((s) => s.stack[0]?.id ?? null);
  const editingId = useDraft((s) => (s.mode === 'edit' ? s.itemId : null));
  const drawingLine = useDraft((s) => s.mode !== null && s.category === 'line');
  const draftActive = useDraft((s) => s.mode !== null);
  const measuring = useMeasure((s) => s.active);
  const plotEntryOpen = useQuickPlot((s) => s.entryOpen);
  const plotTemp = useQuickPlot((s) => s.temp);
  const quickPlotting = plotEntryOpen || plotTemp !== null;
  const placing = usePlacing((s) => s.category);
  const opPhase = useOp((s) => s.phase);
  const opPicking = opPhase === 'picking';
  const manualChoosing = useManualEntry((s) => s.phase === 'choosing');
  const showCenterGrid = useSettings((s) => s.showCenterGrid);
  const lineDrawing = useDraft((s) => (s.category === 'line' || s.category === 'polygon') && s.mode !== null && !s.locked);
  const drawingPolygon = useDraft((s) => s.mode !== null && s.category === 'polygon');
  // A draft-follow move still in flight: a padding change must complete it, not cancel it.
  const followTarget = useRef<LatLon | null>(null);
  // A line fit still in flight: a padding change re-issues it instead of cancelling it.
  const fitTarget = useRef<{ sw: LatLon; ne: LatLon } | null>(null);
  // Every camera move carries the panel's full padding: a move without it targets the padding of the
  // moment (possibly mid-animation) and replaces the running padding ease (rnmapbox 10 iOS).
  const moveCamera = useCallback((stop: Omit<CameraStop, 'padding'>) => {
    // Standing at an OP the camera is the OP's own: no ease may move it.
    if (useOp.getState().phase === 'on') return;
    cameraRef.current?.setCamera({ ...stop, padding: cameraPaddingFor(useMenu.getState().panelFrame) });
  }, []);
  // Fit a line into the map area the panel leaves visible, as a padded center + zoom move.
  const fitCamera = useCallback(
    (bounds: { sw: LatLon; ne: LatLon }, animationDuration: number) => {
      if (useOp.getState().phase === 'on') return;
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

  // Looking at a point (tapping one in the polygon view) centers the map on it, keeping the zoom.
  useEffect(
    () =>
      useDraft.subscribe((state, prev) => {
        if (state.lookRev === prev.lookRev || !state.lookTarget) return;
        markMoved();
        if (useInteraction.getState().followMode) setFollowMode(false);
        followTarget.current = state.lookTarget;
        fitTarget.current = null;
        moveCamera({ centerCoordinate: [state.lookTarget.lon, state.lookTarget.lat], ...EASE, animationDuration: 400 });
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
        useOp.getState().cancel();
        if (useMeasure.getState().active) useMeasure.getState().stopMeasure();
        if (usePlacing.getState().category) usePlacing.getState().stop();
        const q = useQuickPlot.getState();
        if (q.entryOpen || q.temp) q.close();
        useManualEntry.getState().close();
      }),
    [],
  );
  // Opening the Set manually box (from the ME readout or Settings) ends menus and the other map modes, like quick plot.
  useEffect(
    () =>
      useManualEntry.subscribe((state, prev) => {
        if (prev.phase !== 'closed' || state.phase !== 'entry') return;
        useMenu.getState().closeMenu();
        useQuickPlot.getState().close();
        useMeasure.getState().stopMeasure();
        usePlacing.getState().stop();
        useOp.getState().cancel();
      }),
    [],
  );
  useEffect(
    () => () => {
      useMeasure.getState().stopMeasure();
      useQuickPlot.getState().close();
      usePlacing.getState().stop();
      useManualEntry.getState().close();
    },
    [],
  );
  useEffect(() => () => useOp.getState().exit(), []);
  const toggleMeasure = () => {
    if (useMeasure.getState().active) useMeasure.getState().stopMeasure();
    else {
      useMenu.getState().closeMenu();
      useQuickPlot.getState().close();
      usePlacing.getState().stop();
      useManualEntry.getState().close();
      // Measuring works inside OP mode; it only ends picking an OP.
      useOp.getState().cancel();
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
      useManualEntry.getState().close();
      // Plotting works inside OP mode; it only ends picking an OP.
      useOp.getState().cancel();
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

  /** Stakes the OP at `at`: 3D on (the setting only, no tilt), padding cleared, then the store takes over the camera. */
  const stakeAt = (at: LatLon) => {
    if (!useSettings.getState().terrain3d) useSettings.getState().toggleTerrain3d();
    cameraRef.current?.setCamera({ padding: cameraPaddingFor(null), animationDuration: 0 });
    // Follow and fit targets must not outlive staking: map gestures are off, so nothing else would clear them.
    if (useInteraction.getState().followMode) setFollowMode(false);
    followTarget.current = null;
    fitTarget.current = null;
    useOp.getState().stake(at, useInteraction.getState().cameraBearing);
  };
  /** Leaves OP mode: back to normal 3D over the OP, facing the same way. Reads the OP first, since exit() clears it. */
  const exitOp = (pitch = THREE_D_PITCH) => {
    const { at, bearing } = useOp.getState();
    useOp.getState().exit();
    if (at) moveCamera({ centerCoordinate: [at.lon, at.lat], zoomLevel: 15, pitch, heading: bearing, ...EASE, animationDuration: 800 });
  };
  /** LINE and POLYGON leave OP mode first (easing back over the OP); picking is simply cancelled. */
  const leaveOp = () => {
    if (useOp.getState().phase === 'on') exitOp();
    else useOp.getState().cancel();
  };
  const toggleOp = () => {
    const { phase } = useOp.getState();
    if (phase === 'on') {
      exitOp();
      return;
    }
    if (phase === 'picking') {
      useOp.getState().exit();
      return;
    }
    useMenu.getState().closeMenu();
    useMeasure.getState().stopMeasure();
    useQuickPlot.getState().close();
    usePlacing.getState().stop();
    useManualEntry.getState().close();
    useOp.getState().startPicking();
  };

  const toggleLayers = () => {
    if (rootId === 'layers') useMenu.getState().closeMenu();
    else useMenu.getState().openMenu('layers', {});
  };
  const toggleAdd = (id: 'line.add' | 'polygon.add') => {
    if (topId === id) {
      useMenu.getState().closeMenu();
      return;
    }
    leaveOp();
    if (id === 'line.add') useMenu.getState().openMenu('line.add', {});
    else useMenu.getState().openMenu('polygon.add', {});
  };
  // UNIT / POINT wait for a map tap (or CTR) before their Add menu opens.
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
    useManualEntry.getState().close();
    // Placing a unit or point works inside OP mode (tap or CTR); it only ends picking an OP.
    useOp.getState().cancel();
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
  // When an item was last tapped: a blank-map tap right after it is the same touch (see onMapPress).
  const lastItemPressAt = useRef(0);
  // Map button: the next tap on the map (or on a point) places the draft there.
  const onMapPress = (coord: LatLon) => {
    const manual = useManualEntry.getState();
    if (manual.phase === 'choosing') {
      manual.choose(coord);
      return;
    }
    // A stray tap must not lose what was typed in the Set manually box: it only puts the keyboard away.
    if (manual.phase === 'entry') {
      Keyboard.dismiss();
      return;
    }
    if (useOp.getState().phase === 'picking') {
      stakeAt(coord);
      return;
    }
    // Likewise for quick plot: only its Cancel closes it.
    if (useQuickPlot.getState().entryOpen) {
      Keyboard.dismiss();
      return;
    }
    const placingCategory = usePlacing.getState().category;
    if (useMeasure.getState().active) useMeasure.getState().place(coord);
    else if (placingCategory) placeAt(placingCategory, coord);
    else if (isDrawing()) placeDraftPoint(coord);
    else if (useDraft.getState().picking) useDraft.getState().setCoord(coord, 'press');
    else if (isViewingItem() && Date.now() - lastItemPressAt.current > SAME_TOUCH_MS) {
      // A tap on a blank spot clears the selection (an item being viewed, not one being edited).
      useMenu.getState().closeMenu();
    }
  };
  const onItemPress = (itemId: string, at: LatLon, item: ItemRef, itemAt?: LatLon | null) => {
    if (useManualEntry.getState().phase === 'choosing') {
      useManualEntry.getState().choose(itemAt ?? at);
      return;
    }
    if (useOp.getState().phase === 'picking') {
      // Staking on a unit or point is felt like selecting it; a line or polygon stakes at the tapped spot.
      if (item.kind === 'point') notifySelected();
      stakeAt(itemAt ?? at);
      return;
    }
    // Measuring snaps to the symbol itself (lines pass no itemAt: the tap point is used).
    const placingCategory = usePlacing.getState().category;
    if (useMeasure.getState().active) useMeasure.getState().place(itemAt ?? at);
    else if (placingCategory) placeAt(placingCategory, at);
    else if (isDrawing()) placeDraftPoint(at);
    else if (useDraft.getState().picking) useDraft.getState().setCoord(at, 'press');
    else {
      lastItemPressAt.current = Date.now();
      notifySelected();
      openItemMenu(itemId, item);
    }
  };
  /** Staking on your own location is felt like selecting a unit or point. */
  const stakeOnSelf = (at: LatLon) => {
    notifySelected();
    stakeAt(at);
  };
  const onLongPress = (coord: LatLon) => {
    if (!useSettings.getState().longPressAddUnit) return;
    // In OP mode a finger held to look around reads as a long-press (the map itself stays still): it never adds a unit.
    if (useMeasure.getState().active || useOp.getState().phase === 'on') return;
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
  // Tilts into 3D, or back to flat (where tilting is locked).
  const toggleThreeD = () => {
    const inOp = useOp.getState().phase === 'on';
    useSettings.getState().toggleTerrain3d();
    // From OP mode, one move: back over the OP and flat (a second move would cancel the exit ease).
    if (inOp) {
      exitOp(useSettings.getState().terrain3d ? THREE_D_PITCH : 0);
      return;
    }
    moveCamera({ pitch: useSettings.getState().terrain3d ? THREE_D_PITCH : 0, ...EASE, animationDuration: THREE_D_TILT_MS });
  };
  const recenter = () => {
    if (useOp.getState().phase === 'on') return;
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
      <OpGestures>
      <MapCanvas
        cameraRef={cameraRef}
        mapRef={mapRef}
        initialCamera={initialCamera}
        landscape={landscape}
        panel={panel}
        symbolImages={symbols.images}
        onSymbolMissing={symbols.request}
        onCameraIdle={(camera) => {
          // Only arriving ends a draft-follow move: an idle from an earlier move must not drop it.
          if (followTarget.current && isNear(camera.center, followTarget.current)) followTarget.current = null;
          if (fitTarget.current && isInside(camera.center, fitTarget.current)) fitTarget.current = null;
          if (cameraMoved.current && useOp.getState().phase !== 'on') saver.schedule(camera);
        }}
        onLongPress={onLongPress}
        onPress={onMapPress}
        onUserGesture={onUserGesture}>
        <GridLayer />
        {/* Order is draw order, and also tap priority: a tap that touches several layers goes to the topmost one, so a
            unit or line on a range ring's border is selected, not the ring under it. Keep Points above Rings. */}
        <PolygonsLayer missionId={missionId} excludeId={editingId} onItemPress={onItemPress} />
        <RingsLayer missionId={missionId} onItemPress={onItemPress} />
        <LinesLayer missionId={missionId} excludeId={editingId} onItemPress={onItemPress} />
        <PointsLayer missionId={missionId} excludeId={editingId} onItemPress={onItemPress} />
        {draftActive ? <DraftLayer /> : null}
        {drawingLine ? <DraftLineLayer onVertexPress={(i) => useDraft.getState().selectVertex(i)} onPress={onMapPress} /> : null}
        {drawingPolygon ? <DraftPolygonLayer onVertexPress={(i) => useDraft.getState().selectVertex(i)} onPress={onMapPress} /> : null}
        {measuring ? <MeasureLayer /> : null}
        {plotTemp ? <QuickPlotLayer /> : null}
        <ManualPreviewLayer />
        <SelfLayer onPress={opPicking ? stakeOnSelf : measuring ? (at) => useMeasure.getState().place(at) : undefined} />
      </MapCanvas>
      </OpGestures>
      <Crosshair panel={opPhase === 'on' ? null : panel} />
      <Toolbar
        landscape={landscape}
        // The drawer open on the left: the landscape toolbar narrows to its right (null while closed or minimized).
        panelInset={panel?.side === 'left' ? panel.size : 0}
        activeTool={
          // A tool running inside OP mode is the one lit; OP is lit otherwise while picking or at an OP.
          (quickPlotting ? 'plot' : measuring ? 'measure' : placing ?? (topId === 'unit.add' ? 'unit' : topId === 'point.add' ? 'point' : topId === 'line.add' ? 'line' : topId === 'polygon.add' ? 'polygon' : rootId === 'layers' ? 'layers' : null)) ??
          (opPhase !== 'off' ? 'op' : null)
        }
        onUnit={() => togglePlacing('unit')}
        onPoint={() => togglePlacing('point')}
        onLine={() => toggleAdd('line.add')}
        onPolygon={() => toggleAdd('polygon.add')}
        onMeasure={toggleMeasure}
        onPlot={toggleQuickPlot}
        onLayers={toggleLayers}
        onMenu={() => useMenu.getState().openMenu('app.root', {})}
        labelsOn={labelsOn}
        onLabels={() => useSettings.getState().toggleMapLabels()}
        threeDOn={threeDOn}
        onThreeD={toggleThreeD}
        onOp={toggleOp}
      />
      <MapControls
        following={followMode}
        canRecenter={hasSelfPosition}
        onSetLocation={() => useManualEntry.getState().open('map', null)}
        onNorthUp={northUp}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onRecenter={recenter}
        // In OP mode a menu covers the readout and bar rather than pushing them up into the view.
        panel={opPhase === 'on' ? null : panel}
        showNorthUp={opPhase !== 'on'}
        side={
          opPhase === 'on' ? (
            // Bottom right, in the zoom buttons' place: eye height, then Exit on its own.
            <View testID="op-side" pointerEvents="box-none" className="flex-1 items-end justify-end gap-3">
              <OpEyeSlider />
              <MenuButton glass compact label="Exit" icon="close" onPress={() => exitOp()} />
            </View>
          ) : undefined
        }
        landscape={landscape}
        // In landscape the temp card sits beside the dock, which drops its CTR row to leave it room; in portrait the dock keeps it, under the card.
        showCenter={showCenterGrid && !(landscape && plotTemp)}
        barOverDock={!lineDrawing && (!!placing || opPicking || manualChoosing)}
        bar={
          lineDrawing ? (
            <LineDrawBar />
          ) : placing ? (
            <PlaceBar onAtCenter={() => placeAt(placing)} onCancel={() => usePlacing.getState().stop()} />
          ) : opPicking ? (
            <PlaceBar onAtCenter={() => stakeAt(useInteraction.getState().cameraCenter ?? WORLD_CAMERA.center)} onCancel={() => useOp.getState().cancel()} />
          ) : manualChoosing ? (
            <PlaceBar
              hint="Tap your position"
              onAtCenter={() => useManualEntry.getState().choose(useInteraction.getState().cameraCenter ?? WORLD_CAMERA.center)}
              onCancel={() => useManualEntry.getState().cancelChoosing()}
            />
          ) : measuring ? (
            <MeasureBar />
          ) : null
        }
      />
      {plotEntryOpen ? <QuickPlotEntry landscape={landscape} /> : null}
      <ManualLocationEntry landscape={landscape} />
      {plotTemp && !plotEntryOpen ? <QuickPlotCard landscape={landscape} panel={panel} /> : null}
      <MapTopLeft landscape={landscape} panel={panel} />
      <MenuHost landscape={landscape} missionId={missionId} />
      <Toast top={insets.top + EDGE + toolbar + GAP} />
    </View>
  );
}
