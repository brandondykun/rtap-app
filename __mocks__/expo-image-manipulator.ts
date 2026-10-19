export const SaveFormat = { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' } as const;

let saved = 0;

/** Size of every image the mock "decodes"; tests may change it. */
export const __source = { width: 1170, height: 2532 };

/** Each save "writes" a new cache file; the last crop, resize and save options are recorded for assertions. */
export const __last: { crop?: unknown; resize?: unknown; save?: unknown } = {};

export const ImageManipulator = {
  manipulate: jest.fn((_source: unknown) => ({
    crop(rect: unknown) {
      __last.crop = rect;
      return this;
    },
    resize(size: unknown) {
      __last.resize = size;
      return this;
    },
    renderAsync: async () => ({
      width: __source.width,
      height: __source.height,
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
