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
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  watchHeadingAsync: jest.fn(async () => ({ remove: jest.fn() })),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
require('react-native-gesture-handler/jestSetup');
