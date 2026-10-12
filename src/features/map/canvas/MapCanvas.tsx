import { Camera, Images, MapView, type MapState } from '@rnmapbox/maps';
import { useEffect, useMemo, type ReactNode, type Ref } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MissionCamera } from '@/features/missions/repository';
import { useInteraction } from '@/stores/interaction';

import { MAP_IMAGES } from '../images/map-images';
import { ornamentPositions, type Insets } from '../layout';
import { cameraFromMapState, toCameraStop } from './camera';
import { createLatestThrottle } from './frame-throttle';
import { MAP_STYLE_URL } from './mapbox';

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

type Props = {
  cameraRef: Ref<Camera>;
  /** Applied once at mount (uncontrolled camera); later moves go through cameraRef. */
  initialCamera: MissionCamera;
  onCameraIdle: (camera: MissionCamera) => void;
  /** Called while the user drags/pinches the map (turns follow mode off). */
  onUserGesture: () => void;
  landscape: boolean;
  children?: ReactNode;
};

export function MapCanvas({ cameraRef, initialCamera, onCameraIdle, onUserGesture, landscape, children }: Props) {
  const insets = useSafeAreaInsets();
  // Mapbox on iOS measures ornament margins from the safe area already.
  const ornaments = ornamentPositions({ landscape, insets: Platform.OS === 'ios' ? NO_INSETS : insets });
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
      style={{ flex: 1 }}
      styleURL={MAP_STYLE_URL}
      compassEnabled={false}
      pitchEnabled={false}
      scaleBarEnabled={false}
      logoPosition={ornaments.logo}
      attributionPosition={ornaments.attribution}
      onCameraChanged={onCameraChanged}
      onMapIdle={onMapIdle}>
      <Camera ref={cameraRef} defaultSettings={toCameraStop(initialCamera)} />
      <Images images={MAP_IMAGES} />
      {children}
    </MapView>
  );
}
