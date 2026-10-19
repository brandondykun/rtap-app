export const SaveFormat = { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' } as const;

let saved = 0;

/** Each save "writes" a new cache file; the last resize and save options are recorded for assertions. */
export const __last: { resize?: unknown; save?: unknown } = {};

export const ImageManipulator = {
  manipulate: jest.fn((_uri: string) => ({
    resize(size: unknown) {
      __last.resize = size;
      return this;
    },
    renderAsync: async () => ({
      saveAsync: async (options: unknown) => {
        __last.save = options;
        saved += 1;
        const uri = `file:///cache/manipulated-${saved}.jpg`;
        (jest.requireMock('expo-file-system') as { __files: Set<string> }).__files.add(uri);
        return { uri, width: 720, height: 1560 };
      },
    }),
  })),
};
