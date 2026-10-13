import { LINE_TYPES, lineLabel, lineStyle, lineTypeInfo, lineTypeOf } from './line-types';

describe('line types', () => {
  it('has the 10 agreed types with prefixes and styles', () => {
    expect(LINE_TYPES.map((t) => [t.id, t.prefix, t.dash, t.width, t.endArrow, t.decoration])).toEqual([
      ['phase-line', 'PL', 'solid', 'normal', false, 'none'],
      ['line-of-departure', 'LD', 'solid', 'normal', false, 'none'],
      ['limit-of-advance', 'LOA', 'solid', 'normal', false, 'none'],
      ['boundary', null, 'solid', 'heavy', false, 'none'],
      ['route', 'RTE', 'solid', 'normal', true, 'none'],
      ['axis-of-advance', 'AXIS', 'solid', 'wide', true, 'none'],
      ['flot', 'FLOT', 'solid', 'normal', false, 'flot-arcs'],
      ['restrictive-fire-line', 'RFL', 'dashed', 'normal', false, 'none'],
      ['coordinated-fire-line', 'CFL', 'dashed', 'normal', false, 'none'],
      ['fscl', 'FSCL', 'solid', 'normal', false, 'none'],
    ]);
    expect(lineTypeInfo('fscl').label).toBe('Fire support coordination line');
  });

  it('labels with the prefix once, and boundaries with the name only', () => {
    expect(lineLabel('phase-line', 'RED')).toBe('PL RED');
    expect(lineLabel('phase-line', 'PL RED')).toBe('PL RED');
    // Case-sensitive: names are typed upper-case (the field uses autoCapitalize="characters").
    expect(lineLabel('phase-line', 'pl red')).toBe('PL pl red');
    expect(lineLabel('boundary', 'NORTH')).toBe('NORTH');
    expect(lineLabel('restrictive-fire-line', ' ALPHA ')).toBe('RFL ALPHA');
  });

  it('stores the type in style JSON and falls back to phase line', () => {
    expect(lineTypeOf(lineStyle('route'))).toBe('route');
    expect(lineTypeOf(null)).toBe('phase-line');
    expect(lineTypeOf('not json')).toBe('phase-line');
    expect(lineTypeOf('{"lineType":"nope"}')).toBe('phase-line');
  });
});
