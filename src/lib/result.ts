/** Success/failure value used by geo functions and commands instead of throwing. */
export type Result<T, E extends string = string> =
  | { ok: true; value: T }
  | { ok: false; error: E; message: string };

export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function err<E extends string>(error: E, message: string): { ok: false; error: E; message: string } {
  return { ok: false, error, message };
}
