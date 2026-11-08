import { circlePath, contourLines, contourPaths, gridLines, landingFit, sceneLayout, sceneScale, screenBearingDeg } from './landing-art';

describe('landing art', () => {
  it('draws rolling contours down past the bottom edge, and a hill of three rings', () => {
    const paths = contourPaths(390, 874);
    const open = paths.filter((d) => !d.endsWith('Z'));
    const rings = paths.filter((d) => d.endsWith('Z'));
    expect(rings).toHaveLength(3);
    // One every 40 pt, starting 20 pt down, with one more beyond the bottom.
    expect(open).toHaveLength(Math.ceil((874 + 40 - 20) / 40));
    for (const d of open) expect(d).toMatch(/^M-20 [-\d.]+ Q/);
  });

  // Phones both ways round, small and large.
  const SCREENS = [
    [390, 874],
    [375, 697],
    [430, 962],
    [874, 420],
    [697, 405],
  ] as const;

  it.each(SCREENS)('bends every line round the hill, clear of its outer ring (%i × %i)', (width, height) => {
    const { waves, rings } = contourLines(width, height);
    const outer = rings[rings.length - 1];
    // The hill's middle, and the outer ring's reach in every direction (it is wider than tall: compare in its own shape).
    const c = { x: outer.reduce((s, p) => s + p.x, 0) / outer.length, y: outer.reduce((s, p) => s + p.y, 0) / outer.length };
    const reach = (p: { x: number; y: number }) => Math.hypot((p.x - c.x) / 1.6, p.y - c.y);
    const ringReach = Math.max(...outer.map(reach));
    for (const wave of waves) for (const p of wave) expect(reach(p)).toBeGreaterThan(ringReach);
  });

  it.each(SCREENS)('never lets two lines cross: each stays below the one above it, all the way across (%i × %i)', (width, height) => {
    const { waves } = contourLines(width, height);
    for (let i = 1; i < waves.length; i++) {
      waves[i].forEach((p, k) => expect(p.y - waves[i - 1][k].y).toBeGreaterThan(4));
    }
  });

  it('leaves the lines away from the hill as they were', () => {
    const { waves } = contourLines(390, 874);
    // The first line, far above the hill, at the far right, far from it: its plain roll.
    const p = waves[0][waves[0].length - 1];
    const plain = 20 + (14 * (Math.sin(p.x / 70) + 0.5 * Math.sin(p.x / 31))) / 1.5;
    expect(p.y).toBeCloseTo(plain, 0);
  });

  it('is the same art every time', () => {
    expect(contourPaths(390, 874)).toEqual(contourPaths(390, 874));
  });

  it('grids the screen in squares 44% of its short side, numbered left to right and top to bottom', () => {
    const portrait = gridLines(390, 844);
    // 172 pt squares, the first 112 pt in.
    expect(portrait.xs).toEqual([112, 284]);
    expect(portrait.ys).toEqual([112, 284, 456, 628, 800]);
    expect(portrait.path).toBe('M112 0 V844 M284 0 V844 M0 112 H390 M0 284 H390 M0 456 H390 M0 628 H390 M0 800 H390');
    // Landscape keeps the same squares (the short side is the same).
    expect(gridLines(844, 390).xs[1] - gridLines(844, 390).xs[0]).toBe(172);
  });

  it('gives a bearing in degrees clockwise from up', () => {
    const o = { x: 100, y: 100 };
    expect(screenBearingDeg(o, { x: 100, y: 0 })).toBe(0);
    expect(screenBearingDeg(o, { x: 200, y: 100 })).toBe(90);
    expect(screenBearingDeg(o, { x: 100, y: 200 })).toBe(180);
    expect(screenBearingDeg(o, { x: 0, y: 100 })).toBe(270);
  });

  it('draws a circle as two arcs from its left edge', () => {
    expect(circlePath({ x: 50, y: 40 }, 10)).toBe('M40 40 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 Z');
  });

  it('measures from the first friendly to the hostile, the label on the line\'s middle, everything inside the box', () => {
    const { friendly, support, hostile, label } = sceneLayout(300, 200);
    for (const p of [friendly, support, hostile]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(300);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(200);
    }
    expect(friendly.x).toBeLessThan(hostile.x);
    expect(label).toEqual({ x: (friendly.x + hostile.x) / 2, y: (friendly.y + hostile.y) / 2 });
    // BRAVO-2's label sits on its line, nearer BRAVO-2, clear of the hostile's ring.
    const { supportLabel } = sceneLayout(300, 200);
    const along = (supportLabel.x - support.x) / (hostile.x - support.x);
    expect(along).toBeCloseTo((supportLabel.y - support.y) / (hostile.y - support.y));
    expect(along).toBeLessThan(0.5);
  });

  it('tightens the landing to the phone: roomy on a large one, compact on an SE, tight on a small Android', () => {
    // Height between the safe-area insets.
    expect(landingFit(844 - 47 - 34, false)).toBe('roomy');
    expect(landingFit(667 - 20, false)).toBe('compact');
    expect(landingFit(592, false)).toBe('tight');
    // Landscape: an iPhone 14 on its side, an SE, a small Android.
    expect(landingFit(390 - 21, true)).toBe('compact');
    expect(landingFit(375, true)).toBe('compact');
    expect(landingFit(336, true)).toBe('tight');
    // Larger text needs more room, so a large phone with it turned up goes compact.
    expect(landingFit(763, false, 1.15)).toBe('compact');
  });

  it('scales the scene down in a box smaller than it was drawn for, but never below 0.6', () => {
    expect(sceneScale(334, 330)).toBe(1);
    expect(sceneScale(334, 240)).toBeCloseTo(0.8);
    expect(sceneScale(334, 100)).toBe(0.6);
  });
});
