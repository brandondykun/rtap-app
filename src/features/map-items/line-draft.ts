import type { LatLon } from '@/lib/geo/types';

/** A line being edited: its points, the selected one, and where the next point is inserted. */
export type LineEdit = { vertices: LatLon[]; selected: number | null; insertAfter: number | null };

/** Appends, or inserts right after `insertAfter` (selecting it and moving the insert point along). */
export function addVertex(e: LineEdit, p: LatLon): LineEdit {
  if (e.insertAfter === null) return { ...e, vertices: [...e.vertices, p] };
  const at = e.insertAfter + 1;
  return { vertices: [...e.vertices.slice(0, at), p, ...e.vertices.slice(at)], selected: at, insertAfter: at };
}

export function moveVertex(e: LineEdit, i: number, p: LatLon): LineEdit {
  if (i < 0 || i >= e.vertices.length) return e;
  return { ...e, vertices: e.vertices.map((v, k) => (k === i ? p : v)) };
}

/** A saved shape keeps at least `min` points (2 for lines, 3 for polygons); while building (fewer) anything goes. */
export function canRemove(e: LineEdit, i: number, min = 2): boolean {
  return i >= 0 && i < e.vertices.length && (e.vertices.length > min || e.vertices.length < min);
}

export function removeVertex(e: LineEdit, i: number, min = 2): LineEdit {
  if (!canRemove(e, i, min)) return e;
  const shift = (k: number | null) => (k === null || k === i ? null : k > i ? k - 1 : k);
  return { vertices: e.vertices.filter((_, k) => k !== i), selected: shift(e.selected), insertAfter: shift(e.insertAfter) };
}

/** Tapping the selected point again deselects it; any selection ends insert mode. */
export function selectVertex(e: LineEdit, i: number | null): LineEdit {
  const selected = i !== null && i === e.selected ? null : i;
  return { ...e, selected, insertAfter: null };
}

export function startInsertAfter(e: LineEdit, i: number): LineEdit {
  return { ...e, selected: i, insertAfter: i };
}
