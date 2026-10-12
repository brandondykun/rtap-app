import type { Camera } from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { LocationBanner } from '@/features/location/LocationBanner';
import { useSelfLocation } from '@/features/location/use-self-location';
import type { MissionCamera } from '@/features/missions/repository';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { useCommandContext } from '@/lib/db/command-context-provider';
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
import { isLandscape } from './layout';

const EASE = { animationMode: 'easeTo' as const };

export function MissionMap({ missionId, savedCamera }: { missionId: string; savedCamera: MissionCamera | null }) {
  const ctx = useCommandContext();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const landscape = isLandscape(width, height);
  const cameraRef = useRef<Camera>(null);
  const [initialCamera] = useState(() => savedCamera ?? WORLD_CAMERA);
  // With a saved camera the map opens where the user left it; otherwise the first fix centers it.
  const centeredOnSelf = useRef(savedCamera !== null);
  const followMode = useInteraction((s) => s.followMode);
  const setFollowMode = useInteraction((s) => s.setFollowMode);
  const selfPosition = usePresence((s) => s.selfPosition?.position ?? null);
  const saver = useCameraPersistence(ctx, missionId);
  useSelfLocation();

  useEffect(() => () => useInteraction.getState().reset(), []);

  useEffect(() => {
    if (!selfPosition) return;
    const centerCoordinate: [number, number] = [selfPosition.lon, selfPosition.lat];
    if (!centeredOnSelf.current) {
      centeredOnSelf.current = true;
      cameraRef.current?.setCamera({ centerCoordinate, zoomLevel: SELF_ZOOM, animationDuration: 0 });
    } else if (followMode) {
      cameraRef.current?.setCamera({ centerCoordinate, ...EASE, animationDuration: 500 });
    }
  }, [selfPosition, followMode]);

  const onUserGesture = () => {
    if (useInteraction.getState().followMode) setFollowMode(false);
  };
  const zoomBy = (delta: number) => {
    const zoomLevel = clampZoom(useInteraction.getState().cameraZoom + delta);
    cameraRef.current?.setCamera({ zoomLevel, ...EASE, animationDuration: 250 });
  };
  const northUp = () => cameraRef.current?.setCamera({ heading: 0, ...EASE, animationDuration: 300 });
  const recenter = () => {
    if (!selfPosition) return;
    setFollowMode(true);
    const zoomLevel = Math.max(useInteraction.getState().cameraZoom, SELF_ZOOM);
    cameraRef.current?.setCamera({ centerCoordinate: [selfPosition.lon, selfPosition.lat], zoomLevel, ...EASE, animationDuration: 500 });
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
        onCameraIdle={saver.schedule}
        onUserGesture={onUserGesture}>
        <PointsLayer missionId={missionId} />
        <SelfLayer />
      </MapCanvas>
      <Crosshair />
      <Toolbar landscape={landscape} activeTool={null} onMenu={switchMission} />
      <MapControls
        following={followMode}
        canRecenter={selfPosition !== null}
        onNorthUp={northUp}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onRecenter={recenter}
      />
      <ReadoutCard />
      <LocationBanner />
    </View>
  );
}
