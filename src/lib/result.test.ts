import { err, ok, type Result } from './result';

describe('Result', () => {
  it('ok wraps a value', () => {
    const r: Result<number> = ok(3);
    expect(r).toEqual({ ok: true, value: 3 });
  });

  it('err carries a typed code and message', () => {
    const r: Result<number, 'bad'> = err('bad', 'it broke');
    expect(r).toEqual({ ok: false, error: 'bad', message: 'it broke' });
  });

  it('narrows on ok', () => {
    const r: Result<string, 'x'> = Math.random() > 2 ? err('x', '') : ok('yes');
    if (r.ok) {
      expect(r.value.toUpperCase()).toBe('YES');
    } else {
      throw new Error('unreachable');
    }
  });
});
