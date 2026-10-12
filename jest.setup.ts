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
