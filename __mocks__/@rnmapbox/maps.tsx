/* Manual Jest mock for @rnmapbox/maps. Activate per test file with jest.mock('@rnmapbox/maps'). */
import { forwardRef, useEffect, useImperativeHandle, type ReactNode } from 'react';
import { View } from 'react-native';

type Props = Record<string, unknown> & { id?: string; children?: ReactNode };

/** Last props each component received: by component name, then layer/source id ('main' when none). */
export const __props: Record<string, Record<string, Props>> = {
  MapView: {},
  Camera: {},
  Images: {},
  ShapeSource: {},
  SymbolLayer: {},
  LineLayer: {},
  FillLayer: {},
  RasterDemSource: {},
  Terrain: {},
  Atmosphere: {},
};
export const __camera = { setCamera: jest.fn() };

export const __map = {
  takeSnap: jest.fn(async (_writeToDisk?: boolean) => 'file:///cache/snap.png'),
  queryTerrainElevation: jest.fn(async (_coordinate: number[]): Promise<number | null> => null),
};

export const MapView = forwardRef(function MapView(props: Props, ref) {
  __props.MapView.main = props;
  useImperativeHandle(ref, () => __map);
  return <View testID="map-view">{props.children}</View>;
});

export const Camera = forwardRef(function Camera(props: Props, ref) {
  __props.Camera.main = props;
  useImperativeHandle(ref, () => __camera);
  return null;
});

export function Images(props: Props) {
  // The runtime-symbols instance is the one with onImageMissing (Images has no testID prop).
  __props.Images[props.onImageMissing ? 'symbols' : 'main'] = props;
  return null;
}

export function ShapeSource(props: Props) {
  __props.ShapeSource[props.id ?? 'main'] = props;
  return <>{props.children}</>;
}

export function SymbolLayer(props: Props) {
  __props.SymbolLayer[props.id ?? 'main'] = props;
  return null;
}

export function LineLayer(props: Props) {
  __props.LineLayer[props.id ?? 'main'] = props;
  return null;
}

export function FillLayer(props: Props) {
  __props.FillLayer[props.id ?? 'main'] = props;
  return null;
}

export function RasterDemSource(props: Props) {
  __props.RasterDemSource[props.id ?? 'main'] = props;
  return null;
}

export function Terrain(props: Props) {
  __props.Terrain.main = props;
  return null;
}

export function Atmosphere(props: Props) {
  __props.Atmosphere.main = props;
  // Cleared on unmount, so a test can see the sky go away.
  useEffect(() => () => void delete __props.Atmosphere.main, []);
  return null;
}

export const StyleURL = {
  Satellite: 'mapbox://styles/mapbox/satellite-v9',
  SatelliteStreet: 'mapbox://styles/mapbox/satellite-streets-v11',
  Outdoors: 'mapbox://styles/mapbox/outdoors-v11',
  Dark: 'mapbox://styles/mapbox/dark-v10',
};
export const offlineManager = { createPack: jest.fn(), getPacks: jest.fn(async () => []), deletePack: jest.fn() };
export const setAccessToken = jest.fn();
export const Logger = { setLogCallback: jest.fn() };

export default { setAccessToken, StyleURL, offlineManager };
