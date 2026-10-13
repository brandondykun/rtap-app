import type { Camera } from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast } from '@/components/ui/Toast';
import { LocationBanner } from '@/features/location/LocationBanner';
import { useSelfLocation } from '@/features/location/use-self-location';
import type { MissionCamera } from '@/features/missions/repository';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { LatLon } from '@/lib/geo/types';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';

import { clampZoom, SELF_ZOOM, WORLD_CAMERA } from './canvas/camera';
import { useCameraPersistence } from './canvas/camera-persistence';
import { MapCanvas } from './canvas/MapCanvas';
import { MapControls } from './controls/MapControls';
import { ReadoutCard } from './controls/ReadoutCard';
import { Crosshair } from './interaction/Crosshair';
import { PointsLayer } from './layers/PointsLayer';
import { SelfLayer } from './layers/SelfLayer';
import { EDGE, GAP, isLandscape, TOOLBAR_HEIGHT } from './layout';

const EASE = { animationMode: 'easeTo' as const };

export function MissionMap({ missionId, savedCamera }: { missionId: string; savedCamera: MissionCamera | null }) {
  const ctx = useCommandContext();
  const router = useRouter();
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

  useEffect(() => () => useInteraction.getState().reset(), []);

  useEffect(() => {
    const onFix = ({ lat, lon }: LatLon) => {
      const centerCoordinate: [number, number] = [lon, lat];
      if (!centeredOnSelf.current) {
        centeredOnSelf.current = true;
        markMoved();
        cameraRef.current?.setCamera({ centerCoordinate, zoomLevel: SELF_ZOOM, animationDuration: 0 });
      } else if (useInteraction.getState().followMode) {
        cameraRef.current?.setCamera({ centerCoordinate, ...EASE, animationDuration: 500 });
      }
    };
    const current = usePresence.getState().selfPosition;
    if (current) onFix(current.position);
    return usePresence.subscribe((state, prev) => {
      if (state.selfPosition && state.selfPosition !== prev.selfPosition) onFix(state.selfPosition.position);
    });
  }, [markMoved]);

  const onUserGesture = () => {
    markMoved();
    if (useInteraction.getState().followMode) setFollowMode(false);
  };
  const zoomBy = (delta: number) => {
    markMoved();
    const zoomLevel = clampZoom(useInteraction.getState().cameraZoom + delta);
    cameraRef.current?.setCamera({ zoomLevel, ...EASE, animationDuration: 250 });
  };
  const northUp = () => {
    markMoved();
    cameraRef.current?.setCamera({ heading: 0, ...EASE, animationDuration: 300 });
  };
  const recenter = () => {
    const self = usePresence.getState().selfPosition?.position;
    if (!self) return;
    markMoved();
    setFollowMode(true);
    const zoomLevel = Math.max(useInteraction.getState().cameraZoom, SELF_ZOOM);
    cameraRef.current?.setCamera({ centerCoordinate: [self.lon, self.lat], zoomLevel, ...EASE, animationDuration: 500 });
  };
  // Interim "Switch mission" until Plan 3's app menu.
  const switchMission = () => {
    saver.flush();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View className="flex-1 bg-surface">
      <MapCanvas
        cameraRef={cameraRef}
        initialCamera={initialCamera}
        landscape={landscape}
        onCameraIdle={(camera) => {
          if (cameraMoved.current) saver.schedule(camera);
        }}
        onUserGesture={onUserGesture}>
        <PointsLayer missionId={missionId} />
        <SelfLayer />
      </MapCanvas>
      <Crosshair />
      <Toolbar landscape={landscape} activeTool={null} onMenu={switchMission} />
      <MapControls
        following={followMode}
        canRecenter={hasSelfPosition}
        onNorthUp={northUp}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onRecenter={recenter}
      />
      <ReadoutCard />
      <LocationBanner landscape={landscape} />
      <Toast top={insets.top + EDGE + TOOLBAR_HEIGHT + GAP} />
    </View>
  );
}
