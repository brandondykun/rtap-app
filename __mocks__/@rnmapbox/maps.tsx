/* Manual Jest mock for @rnmapbox/maps. Activate per test file with jest.mock('@rnmapbox/maps'). */
import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { View } from 'react-native';

type Props = Record<string, unknown> & { id?: string; children?: ReactNode };

/** Last props each component received: by component name, then layer/source id ('main' when none). */
export const __props: Record<string, Record<string, Props>> = {
  MapView: {},
  Camera: {},
  Images: {},
  ShapeSource: {},
  SymbolLayer: {},
};
export const __camera = { setCamera: jest.fn() };

export function MapView(props: Props) {
  __props.MapView.main = props;
  return <View testID="map-view">{props.children}</View>;
}

export const Camera = forwardRef(function Camera(props: Props, ref) {
  __props.Camera.main = props;
  useImperativeHandle(ref, () => __camera);
  return null;
});

export function Images(props: Props) {
  __props.Images.main = props;
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

export const StyleURL = { Satellite: 'mapbox://styles/mapbox/satellite-v9' };
export const offlineManager = { createPack: jest.fn(), getPacks: jest.fn(async () => []), deletePack: jest.fn() };
export const setAccessToken = jest.fn();

export default { setAccessToken, StyleURL, offlineManager };
