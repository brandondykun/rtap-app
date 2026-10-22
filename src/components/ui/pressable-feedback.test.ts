import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

/** Every control dims to this while pressed, so a tap always shows it landed. */
const PRESSED = 'active:opacity-60';
/** Marks a pressable that is not a visible control (a backdrop), on the line above it, with the reason after it. */
const EXEMPT = 'pressed-feedback-exempt:';

const SRC = join(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
  });
}

/** Each `<Pressable …>` opening tag in `source`: its text, and the line just above it. */
function pressableTags(source: string): { tag: string; line: number; above: string }[] {
  const tags: { tag: string; line: number; above: string }[] = [];
  const opening = /<Pressable\b/g;
  for (let match = opening.exec(source); match; match = opening.exec(source)) {
    // The tag ends at the first `>` outside braces (so an arrow function's `=>` in a prop does not end it).
    let depth = 0;
    let end = match.index;
    for (; end < source.length; end++) {
      const char = source[end];
      if (char === '{') depth++;
      else if (char === '}') depth--;
      else if (char === '>' && depth === 0) break;
    }
    const lines = source.slice(0, match.index).split('\n');
    tags.push({ tag: source.slice(match.index, end + 1), line: lines.length, above: lines[lines.length - 2] ?? '' });
  }
  return tags;
}

describe('pressed feedback', () => {
  const files = sourceFiles(SRC);

  it(`gives every Pressable ${PRESSED}, unless it is marked as not a visible control`, () => {
    const missing = files.flatMap((file) =>
      pressableTags(readFileSync(file, 'utf8'))
        .filter(({ tag, above }) => !tag.includes(PRESSED) && !above.includes(EXEMPT))
        .map(({ line }) => `${relative(SRC, file)}:${line}`),
    );
    expect(missing).toEqual([]);
  });

  it('uses one pressed opacity everywhere', () => {
    const others = files.flatMap((file) => {
      const found = readFileSync(file, 'utf8').match(/active:opacity-\d+/g) ?? [];
      return found.filter((cls) => cls !== PRESSED).map((cls) => `${relative(SRC, file)}: ${cls}`);
    });
    expect(others).toEqual([]);
  });

  it('finds the pressables it checks', () => {
    expect(files.some((file) => file.endsWith('MenuButton.tsx'))).toBe(true);
    expect(pressableTags('<Pressable style={({ pressed }) => (pressed ? 1 : 0)} className="a">').map((t) => t.tag)).toEqual([
      '<Pressable style={({ pressed }) => (pressed ? 1 : 0)} className="a">',
    ]);
  });
});
