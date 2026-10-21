type Props = Record<string, unknown>;

export type MapboxMock = {
  __props: Record<'MapView' | 'Camera' | 'Images' | 'ShapeSource' | 'SymbolLayer' | 'LineLayer' | 'FillLayer' | 'RasterDemSource' | 'Terrain' | 'Atmosphere', Record<string, Props>>;
  __camera: { setCamera: jest.Mock };
  __map: { takeSnap: jest.Mock; queryTerrainElevation: jest.Mock; _runNative: jest.Mock; queryRenderedFeaturesAtPoint: jest.Mock };
  offlineManager: { createPack: jest.Mock; getPacks: jest.Mock; deletePack: jest.Mock };
  setAccessToken: jest.Mock;
};

/** The mocked @rnmapbox/maps module (call jest.mock('@rnmapbox/maps') in the test file). */
export function mapboxMock(): MapboxMock {
  return jest.requireMock('@rnmapbox/maps') as MapboxMock;
}
