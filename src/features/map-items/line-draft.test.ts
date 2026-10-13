import { addVertex, canRemove, moveVertex, removeVertex, selectVertex, startInsertAfter, type LineEdit } from './line-draft';

const p = (n: number) => ({ lat: 38.9 + n / 100, lon: -77 });
const empty: LineEdit = { vertices: [], selected: null, insertAfter: null };
const three: LineEdit = { vertices: [p(1), p(2), p(3)], selected: null, insertAfter: null };

describe('line draft rules', () => {
  it('appends, and inserts after a chosen point repeatedly in order', () => {
    expect(addVertex(addVertex(empty, p(1)), p(2)).vertices).toEqual([p(1), p(2)]);
    let e = startInsertAfter(three, 0);
    e = addVertex(e, p(9));
    expect(e).toMatchObject({ vertices: [p(1), p(9), p(2), p(3)], selected: 1, insertAfter: 1 });
    e = addVertex(e, p(8));
    expect(e).toMatchObject({ vertices: [p(1), p(9), p(8), p(2), p(3)], selected: 2, insertAfter: 2 });
  });

  it('moves the selected point', () => {
    expect(moveVertex(three, 1, p(7)).vertices).toEqual([p(1), p(7), p(3)]);
  });

  it('removes freely while building but never below 2 once a line has 2+', () => {
    expect(removeVertex({ ...empty, vertices: [p(1)] }, 0).vertices).toEqual([]);
    const two = { ...empty, vertices: [p(1), p(2)] };
    expect(canRemove(two, 0)).toBe(false);
    expect(removeVertex(two, 0)).toBe(two);
    expect(canRemove(three, 2)).toBe(true);
    expect(removeVertex({ ...three, selected: 2 }, 1)).toMatchObject({ vertices: [p(1), p(3)], selected: 1 });
    expect(removeVertex({ ...three, selected: 1 }, 1)).toMatchObject({ selected: null });
  });

  it('toggles selection and clears insert mode', () => {
    expect(selectVertex(three, 1).selected).toBe(1);
    expect(selectVertex({ ...three, selected: 1 }, 1).selected).toBeNull();
    expect(selectVertex({ ...three, insertAfter: 0 }, 2)).toMatchObject({ selected: 2, insertAfter: null });
  });

  it('takes a higher minimum for polygons', () => {
    expect(canRemove(three, 0, 3)).toBe(false);
    expect(removeVertex(three, 0, 3)).toBe(three);
    expect(canRemove({ ...three, vertices: [...three.vertices, p(4)] }, 0, 3)).toBe(true);
    expect(removeVertex({ ...empty, vertices: [p(1), p(2)] }, 0, 3).vertices).toEqual([p(2)]);
  });
});
