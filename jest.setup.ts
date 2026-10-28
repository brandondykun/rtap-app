// Global Jest setup. Native module mocks live here so every test sees the same fakes.

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}));

jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map<string, string>();
  const api = {
    getItemSync: (key: string) => store.get(key) ?? null,
    setItemSync: (key: string, value: string) => void store.set(key, value),
    removeItemSync: (key: string) => void store.delete(key),
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => void store.set(key, value),
    removeItem: async (key: string) => void store.delete(key),
    clearSync: () => store.clear(),
  };
  return { __esModule: true, default: api, Storage: api };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6, High: 4 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied', granted: false })),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied', granted: false })),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  watchHeadingAsync: jest.fn(async () => ({ remove: jest.fn() })),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('expo-screen-orientation', () => {
  const listeners = new Set<(mockEvent: unknown) => void>();
  const Orientation = { UNKNOWN: 0, PORTRAIT_UP: 1, PORTRAIT_DOWN: 2, LANDSCAPE_LEFT: 3, LANDSCAPE_RIGHT: 4 };
  return {
    Orientation,
    getOrientationAsync: jest.fn(async () => Orientation.PORTRAIT_UP),
    addOrientationChangeListener: jest.fn((cb: (mockEvent: unknown) => void) => {
      listeners.add(cb);
      return { remove: () => listeners.delete(cb) };
    }),
    /** Test helper: simulate the screen turning. */
    __emit: (orientation: number) => listeners.forEach((cb) => cb({ orientationInfo: { orientation }, orientationLock: 0 })),
  };
});

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
require('react-native-gesture-handler/jestSetup');
jest.mock('expo-file-system', () => jest.requireActual('./__mocks__/expo-file-system'));
jest.mock('expo-image-manipulator', () => jest.requireActual('./__mocks__/expo-image-manipulator'));
jest.mock('@shopify/react-native-skia', () => ({ Skia: {}, ImageFormat: { PNG: 4 } }));
jest.mock('@/features/symbology/render/get-symbol-image', () => ({ getSymbolImage: jest.fn(async () => null) }));

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setTag: jest.fn(),
  captureException: jest.fn(),
  wrap: <T>(component: T) => component,
}));
