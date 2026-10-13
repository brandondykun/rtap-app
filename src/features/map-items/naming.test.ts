import { nextAutoName, nextNameForPrefix } from './naming';

describe('nextAutoName', () => {
  it('starts at 1', () => {
    expect(nextAutoName('hostile', [])).toBe('HOS-1');
    expect(nextAutoName('friend', [])).toBe('FRD-1');
    expect(nextAutoName('neutral', [])).toBe('NEU-1');
    expect(nextAutoName('unknown', [])).toBe('UNK-1');
  });

  it('continues from the highest existing number for the prefix', () => {
    expect(nextAutoName('hostile', ['HOS-1', 'HOS-4', 'UNK-9'])).toBe('HOS-5');
  });

  it('ignores renamed points and unrelated names', () => {
    expect(nextAutoName('hostile', ['OBJ IRON', 'HOS-x', 'HOS-', 'HOS-2 ALT'])).toBe('HOS-1');
  });

  it('matches case-insensitively and tolerates whitespace and leading zeros', () => {
    expect(nextAutoName('hostile', ['hos-7', ' HOS-04 '])).toBe('HOS-8');
  });
});

describe('nextNameForPrefix', () => {
  it('counts each point prefix separately', () => {
    const names = ['CP-1', 'CP-2', 'OP-1', 'HOS-7', 'LZ HAWK'];
    expect(nextNameForPrefix('CP', names)).toBe('CP-3');
    expect(nextNameForPrefix('OP', names)).toBe('OP-2');
    expect(nextNameForPrefix('LZ', names)).toBe('LZ-1');
    expect(nextNameForPrefix('RLY', ['rly-4'])).toBe('RLY-5');
  });
});
