import { MENU_REGISTRY } from './registry';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

describe('menu icons', () => {
  it('gives every menu its toolbar icon (shown on the minimized drawer button)', () => {
    const icons = Object.fromEntries(Object.values(MENU_REGISTRY).map((m) => [m.id, m.icon]));
    expect(icons).toEqual({
      'app.root': 'menu',
      settings: 'cog-outline',
      layers: 'layers-outline',
      overlays: 'layers-triple-outline',
      'line.add': 'vector-polyline',
      'line.edit': 'vector-polyline',
      'polygon.add': 'pentagon-outline',
      'polygon.edit': 'pentagon-outline',
      'point.add': 'map-marker-outline',
      'point.edit': 'map-marker-outline',
      'unit.add': 'rhombus-outline',
      'unit.edit': 'rhombus-outline',
    });
  });
});
