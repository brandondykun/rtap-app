import { MIN_VISIBLE_SHARE, visibleRect } from './snapshot-crop';

describe('visibleRect', () => {
  it('keeps the whole image without an open panel', () => {
    expect(visibleRect({ width: 2532, height: 1170 }, { view: { width: 844, height: 390 }, panel: null })).toEqual({
      originX: 0,
      originY: 0,
      width: 2532,
      height: 1170,
    });
  });

  it('drops the strip under a left drawer (landscape)', () => {
    // 3x phone: 844 x 390 pt view, 360 pt drawer.
    expect(visibleRect({ width: 2532, height: 1170 }, { view: { width: 844, height: 390 }, panel: { side: 'left', size: 360 } })).toEqual({
      originX: 1080,
      originY: 0,
      width: 1452,
      height: 1170,
    });
  });

  it('drops the strip under a bottom sheet (portrait)', () => {
    // 3x phone: 390 x 844 pt view, 300 pt sheet.
    expect(visibleRect({ width: 1170, height: 2532 }, { view: { width: 390, height: 844 }, panel: { side: 'bottom', size: 300 } })).toEqual({
      originX: 0,
      originY: 0,
      width: 1170,
      height: 1632,
    });
  });

  it('crops the same share of the map whatever the screen size or pixel density', () => {
    const share = (image: { width: number; height: number }, view: { width: number; height: number }, size: number) => {
      const rect = visibleRect(image, { view, panel: { side: 'left', size } });
      if (!rect) throw new Error('expected a rect');
      return { visible: rect.width / image.width, right: rect.originX + rect.width };
    };
    // Small phone (2x), large phone (3x), iPad (2x): drawer covers 40% of the width each time.
    const small = share({ width: 1334, height: 750 }, { width: 667, height: 375 }, 266.8);
    const large = share({ width: 2796, height: 1290 }, { width: 932, height: 430 }, 372.8);
    const tablet = share({ width: 2732, height: 2048 }, { width: 1366, height: 1024 }, 546.4);
    for (const s of [small, large, tablet]) expect(s.visible).toBeCloseTo(0.6, 2);
    // The kept part always reaches the right edge of the image.
    expect([small.right, large.right, tablet.right]).toEqual([1334, 2796, 2732]);
  });

  it('gives up when the panel leaves too little map to be worth a picture', () => {
    const view = { width: 390, height: 844 };
    const covered = 844 * (1 - MIN_VISIBLE_SHARE) + 1;
    expect(visibleRect({ width: 1170, height: 2532 }, { view, panel: { side: 'bottom', size: covered } })).toBeNull();
  });

  it('keeps the whole image when the view size is unknown, and never returns a rect outside the image', () => {
    expect(visibleRect({ width: 100, height: 50 }, { view: { width: 0, height: 0 }, panel: { side: 'left', size: 10 } })).toEqual({
      originX: 0,
      originY: 0,
      width: 100,
      height: 50,
    });
    expect(visibleRect({ width: 100, height: 50 }, { view: { width: 200, height: 100 }, panel: { side: 'left', size: -20 } })).toEqual({
      originX: 0,
      originY: 0,
      width: 100,
      height: 50,
    });
  });
});
