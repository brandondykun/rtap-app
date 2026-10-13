import type { Camera, CameraStop } from '@rnmapbox/maps';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { Toast } from '@/components/ui/Toast';
import { LocationBanner } from '@/features/location/LocationBanner';
import { useSelfLocation } from '@/features/location/use-self-location';
import type { MissionCamera } from '@/features/missions/repository';
import { MenuHost } from '@/features/menus/MenuHost';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { LatLon } from '@/lib/geo/types';
import { useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { useMenu, topMenu } from '@/stores/menu';
import { usePresence } from '@/stores/presence';

import { clampZoom, SELF_ZOOM, WORLD_CAMERA } from './canvas/camera';
import { useCameraPersistence } from './canvas/camera-persistence';
import { MapCanvas } from './canvas/MapCanvas';
import { MapControls } from './controls/MapControls';
import { ReadoutCard } from './controls/ReadoutCard';
import { Crosshair } from './interaction/Crosshair';
import { DraftLayer } from './layers/DraftLayer';
import { PointsLayer } from './layers/PointsLayer';
import { SelfLayer } from './layers/SelfLayer';
import { cameraPaddingFor, EDGE, GAP, isLandscape, TOOLBAR_HEIGHT } from './layout';

const EASE = { animationMode: 'easeTo' as const };

export function MissionMap({ missionId, savedCamera }: { missionId: string; savedCamera: MissionCamera | null }) {
  const ctx = useCommandContext();
  const { width, height } = useWindowDimensions();
  const landscape = isLandscape(width, height);
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
  const draftActive = useDraft((s) => s.mode !== null);
  // A draft-follow move still in flight: a padding change must complete it, not cancel it.
  const followTarget = useRef<LatLon | null>(null);
  // Every camera move carries the panel's full padding: a move without it targets the padding of the
  // moment (possibly mid-animation) and replaces the running padding ease (rnmapbox 10 iOS).
  const moveCamera = useCallback((stop: Omit<CameraStop, 'padding'>) => {
    cameraRef.current?.setCamera({ ...stop, padding: cameraPaddingFor(useMenu.getState().panelFrame) });
  }, []);
  // Pad the camera only when the panel frame changes (not on mount).
  const appliedPanel = useRef<PanelFrame | null>(null);
  useEffect(() => {
    if (panel === appliedPanel.current) return;
    appliedPanel.current = panel;
    const target = followTarget.current;
    moveCamera({ ...(target ? { centerCoordinate: [target.lon, target.lat] } : {}), ...EASE, animationDuration: 250 });
  }, [panel, moveCamera]);

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
        if (state.coordRev === prev.coordRev || !state.coord || state.coordSource === 'crosshair') return;
        markMoved();
        if (useInteraction.getState().followMode) setFollowMode(false);
        followTarget.current = state.coord;
        moveCamera({ centerCoordinate: [state.coord.lon, state.coord.lat], ...EASE, animationDuration: 400 });
      }),
    [markMoved, setFollowMode, moveCamera],
  );

  const togglePoint = () => {
    if (topId === 'point.add') useMenu.getState().closeMenu();
    else useMenu.getState().openMenu('point.add', {});
  };
  // Map button: the next tap on the map (or on a point) places the draft there.
  const onMapPress = (coord: LatLon) => {
    if (useDraft.getState().picking) useDraft.getState().setCoord(coord, 'press');
  };
  const onItemPress = (itemId: string, at: LatLon) => {
    if (useDraft.getState().picking) useDraft.getState().setCoord(at, 'press');
    else useMenu.getState().openMenu('point.edit', { itemId });
  };
  const onLongPress = (coord: LatLon) => {
    const current = topMenu(useMenu.getState())?.id;
    const viewing = current === 'point.edit' && useDraft.getState().locked;
    if ((current === 'point.add' || current === 'point.edit') && !viewing) useDraft.getState().setCoord(coord, 'press');
    else useMenu.getState().openMenu('point.add', { at: coord });
  };

  const onUserGesture = () => {
    followTarget.current = null;
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
          followTarget.current = null;
          if (cameraMoved.current) saver.schedule(camera);
        }}
        onLongPress={onLongPress}
        onPress={onMapPress}
        onUserGesture={onUserGesture}>
        <PointsLayer missionId={missionId} excludeId={editingId} onItemPress={onItemPress} />
        {draftActive ? <DraftLayer /> : null}
        <SelfLayer />
      </MapCanvas>
      <Crosshair panel={panel} />
      <Toolbar
        landscape={landscape}
        activeTool={topId === 'point.add' ? 'point' : null}
        onPoint={togglePoint}
        onMenu={() => useMenu.getState().openMenu('app.root', {})}
        onSettings={() => useMenu.getState().openMenu('settings', {})}
      />
      <MapControls
        following={followMode}
        canRecenter={hasSelfPosition}
        onNorthUp={northUp}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onRecenter={recenter}
        panel={panel}
      />
      {panel ? null : <ReadoutCard />}
      {panel ? null : <LocationBanner landscape={landscape} />}
      <MenuHost landscape={landscape} missionId={missionId} />
      <Toast top={insets.top + EDGE + TOOLBAR_HEIGHT + GAP} />
    </View>
  );
}
