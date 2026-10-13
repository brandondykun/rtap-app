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

/** A saved shape keeps at least 2 points; while building (fewer than 2) anything goes. */
export function canRemove(e: LineEdit, i: number): boolean {
  return i >= 0 && i < e.vertices.length && (e.vertices.length > 2 || e.vertices.length < 2);
}

export function removeVertex(e: LineEdit, i: number): LineEdit {
  if (!canRemove(e, i)) return e;
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
