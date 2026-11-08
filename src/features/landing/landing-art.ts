/** A point in the landing screen's drawing space (pt). */
export type Pt = { x: number; y: number };

/** Gap between the drifting contour lines, and how far they swell above and below their row. */
const CONTOUR_SPACING = 40;
const CONTOUR_SWELL = 14;

/** A smooth SVG path through `points`: quadratic curves via the midpoints, so it has no corners. */
function smoothPath(points: Pt[], closed: boolean): string {
  const r = (n: number) => Math.round(n * 10) / 10;
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  if (closed) {
    const start = mid(points[points.length - 1], points[0]);
    let d = `M${r(start.x)} ${r(start.y)}`;
    points.forEach((p, i) => {
      const m = mid(p, points[(i + 1) % points.length]);
      d += ` Q${r(p.x)} ${r(p.y)} ${r(m.x)} ${r(m.y)}`;
    });
    return `${d} Z`;
  }
  let d = `M${r(points[0].x)} ${r(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const m = mid(points[i], points[i + 1]);
    d += ` Q${r(points[i].x)} ${r(points[i].y)} ${r(m.x)} ${r(m.y)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${r(last.x)} ${r(last.y)}`;
}

/** The hill's rings (pt, before their wobble), how far each swells and shrinks round it, and how much wider than tall. */
const HILL_RADII = [22, 42, 62];
const HILL_WOBBLE = 0.14;
const HILL_STRETCH = 1.6;
/** Clearance between the hill's outer ring and the lines that bend round it. */
const HILL_CLEARANCE = 8;
/**
 * How far the bend reaches up and down: a line this far from the hill moves about a third as much as one beside it.
 * Longer than the widest gap the bend opens, so lines on one side never pass each other.
 */
const BEND_REACH = 160;
/** Beside the hill the lines' own roll calms to this much, so lines bunched there stay apart. */
const BEND_CALM = 0.2;

/** The hill's middle: toward the lower left. */
function hillAt(width: number, height: number): Pt {
  return { x: width * 0.3, y: height * 0.62 };
}

/**
 * The contour lines for a `width` × `height` background: `waves`, gently rolling lines across, top to bottom, and
 * `rings`, a hill toward the lower left, inside out. Like real contours they never cross: where the waves near the hill
 * they bend round it, those above it up and those below it down, bunching a little as at a slope. Fixed (no
 * randomness), so the art is the same on every launch and in tests.
 */
export function contourLines(width: number, height: number): { waves: Pt[][]; rings: Pt[][] } {
  const hill = hillAt(width, height);
  const outer = HILL_RADII[HILL_RADII.length - 1] * (1 + HILL_WOBBLE);
  // The most a line can have to clear above or below the hill: its outer ring, the clearance, and a line's full roll.
  const gap = outer + HILL_CLEARANCE + CONTOUR_SWELL;
  // How much of that gap opens at `x`: all of it across the hill, easing off past its sides. A flattened bell, so it
  // stays open wherever the ring is.
  const opening = (x: number) => Math.exp(-(((x - hill.x) / (1.3 * HILL_STRETCH * outer)) ** 4));

  const waves: Pt[][] = [];
  for (let row = 0, y = CONTOUR_SPACING / 2; y < height + CONTOUR_SPACING; row++, y += CONTOUR_SPACING) {
    // Which side of the hill this line passes; from there, how far it bends at full opening.
    const fromHill = y - hill.y;
    const bend = (fromHill < 0 ? -1 : 1) * gap * Math.exp(-Math.abs(fromHill) / BEND_REACH);
    const points: Pt[] = [];
    for (let x = -20; x <= width + 20; x += 16) {
      const open = opening(x);
      const swell = Math.sin(x / 70 + row * 0.6) + 0.5 * Math.sin(x / 31 - row * 0.9);
      points.push({ x, y: y + bend * open + ((CONTOUR_SWELL * swell) / 1.5) * (1 - (1 - BEND_CALM) * open) });
    }
    waves.push(points);
  }
  const rings = HILL_RADII.map((radius) => {
    const points: Pt[] = [];
    for (let deg = 0; deg < 360; deg += 20) {
      const a = (deg * Math.PI) / 180;
      const wobble = 1 + HILL_WOBBLE * Math.sin(3 * a + radius / 20);
      points.push({ x: hill.x + HILL_STRETCH * radius * wobble * Math.cos(a), y: hill.y + radius * wobble * Math.sin(a) });
    }
    return points;
  });
  return { waves, rings };
}

/** contourLines as smooth SVG paths: the waves, then the hill's rings. */
export function contourPaths(width: number, height: number): string[] {
  const { waves, rings } = contourLines(width, height);
  return [...waves.map((w) => smoothPath(w, false)), ...rings.map((r) => smoothPath(r, true))];
}

/** The grid's squares, as a fraction of the screen's short side, and how far in its first column and row sit (of a square). */
const GRID_FRACTION = 0.44;
const GRID_OFFSET = 0.65;

/**
 * The grid behind the contours: square, GRID_FRACTION of the screen's short side apart. `xs` are the columns (eastings,
 * left to right), `ys` the rows (northings, top to bottom); `path` draws them all.
 */
export function gridLines(width: number, height: number): { xs: number[]; ys: number[]; path: string } {
  const step = Math.round(Math.min(width, height) * GRID_FRACTION);
  const along = (size: number) => {
    const at: number[] = [];
    for (let v = Math.round(step * GRID_OFFSET); v < size; v += step) at.push(v);
    return at;
  };
  const xs = along(width);
  const ys = along(height);
  const path = [...xs.map((x) => `M${x} 0 V${height}`), ...ys.map((y) => `M0 ${y} H${width}`)].join(' ');
  return { xs, ys, path };
}

/** The bearing from `from` to `to` on screen, up being north, in degrees clockwise (0 to under 360). */
export function screenBearingDeg(from: Pt, to: Pt): number {
  const deg = (Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

/** How far along BRAVO-2's line (from BRAVO-2) its label sits. */
const SUPPORT_LABEL_ALONG = 0.35;

/**
 * Where the scene's pieces sit in a `width` × `height` box: two friendly units and a hostile, the measure lines running
 * from each friendly to the hostile, the first's label centered on its middle, the second's partway along.
 */
export function sceneLayout(width: number, height: number): { friendly: Pt; support: Pt; hostile: Pt; label: Pt; supportLabel: Pt } {
  const friendly = { x: width * 0.18, y: height * 0.3 };
  const support = { x: width * 0.4, y: height * 0.82 };
  const hostile = { x: width * 0.8, y: height * 0.55 };
  return {
    friendly,
    support,
    hostile,
    label: { x: (friendly.x + hostile.x) / 2, y: (friendly.y + hostile.y) / 2 },
    // Nearer BRAVO-2 than the hostile, to stay clear of its ring.
    supportLabel: { x: support.x + (hostile.x - support.x) * SUPPORT_LABEL_ALONG, y: support.y + (hostile.y - support.y) * SUPPORT_LABEL_ALONG },
  };
}

/** A circle as an SVG path (two arcs), for a Skia Path. */
export function circlePath(c: Pt, r: number): string {
  return `M${c.x - r} ${c.y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
}

/**
 * How much the landing screen has to tighten to fit: `roomy` as designed; `compact` a smaller title, tighter gaps and
 * a smaller feature list; `tight` also drops the feature list, so the scene and Get started keep their room. Judged by
 * the height left between the safe-area insets, shrunk by the text size the user chose (text grows, the rest does not).
 */
export type LandingFit = 'roomy' | 'compact' | 'tight';

/** Below these heights (pt, at standard text size) the screen goes compact, then tight. */
const FIT_PORTRAIT = { compact: 720, tight: 600 };
const FIT_LANDSCAPE = { compact: 400, tight: 360 };

export function landingFit(usableHeight: number, landscape: boolean, fontScale = 1): LandingFit {
  const h = usableHeight / Math.max(1, fontScale);
  const at = landscape ? FIT_LANDSCAPE : FIT_PORTRAIT;
  return h < at.tight ? 'tight' : h < at.compact ? 'compact' : 'roomy';
}

/** The scene box its ring and symbols are drawn for; smaller boxes scale them down, to no less than SCENE_MIN_SCALE. */
const SCENE_DESIGN = { width: 334, height: 300 };
const SCENE_MIN_SCALE = 0.6;

export function sceneScale(width: number, height: number): number {
  return Math.min(1, Math.max(SCENE_MIN_SCALE, Math.min(width / SCENE_DESIGN.width, height / SCENE_DESIGN.height)));
}
