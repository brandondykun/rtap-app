/** Military control lines the Line menu offers (spec 2026-10-13-lines-design.md §3.1). */
export type LineType =
  | 'phase-line'
  | 'line-of-departure'
  | 'limit-of-advance'
  | 'boundary'
  | 'route'
  | 'axis-of-advance'
  | 'flot'
  | 'restrictive-fire-line'
  | 'coordinated-fire-line'
  | 'fscl';

export type LineTypeInfo = {
  id: LineType;
  label: string;
  /** Label prefix ("PL"); null shows the name alone (boundary). */
  prefix: string | null;
  dash: 'solid' | 'dashed';
  width: 'normal' | 'heavy' | 'wide';
  endArrow: boolean;
  decoration: 'none' | 'flot-arcs';
};

const t = (id: LineType, label: string, prefix: string | null, extra: Partial<LineTypeInfo> = {}): LineTypeInfo => ({
  id,
  label,
  prefix,
  dash: 'solid',
  width: 'normal',
  endArrow: false,
  decoration: 'none',
  ...extra,
});

export const LINE_TYPES: readonly LineTypeInfo[] = [
  t('phase-line', 'Phase line', 'PL'),
  t('line-of-departure', 'Line of departure', 'LD'),
  t('limit-of-advance', 'Limit of advance', 'LOA'),
  t('boundary', 'Boundary', null, { width: 'heavy' }),
  t('route', 'Route', 'RTE', { endArrow: true }),
  t('axis-of-advance', 'Axis of advance', 'AXIS', { width: 'wide', endArrow: true }),
  t('flot', 'Forward line of own troops', 'FLOT', { decoration: 'flot-arcs' }),
  t('restrictive-fire-line', 'Restrictive fire line', 'RFL', { dash: 'dashed' }),
  t('coordinated-fire-line', 'Coordinated fire line', 'CFL', { dash: 'dashed' }),
  t('fscl', 'Fire support coordination line', 'FSCL'),
];

const BY_ID = new Map(LINE_TYPES.map((x) => [x.id, x]));

export function lineTypeInfo(id: LineType): LineTypeInfo {
  return BY_ID.get(id)!;
}

/** "PL RED"; the prefix is not repeated when the name already starts with it; boundaries show the name. */
export function lineLabel(type: LineType, name: string): string {
  const trimmed = name.trim();
  const prefix = lineTypeInfo(type).prefix;
  if (!prefix || trimmed.startsWith(`${prefix} `) || trimmed === prefix) return trimmed;
  return `${prefix} ${trimmed}`;
}

export function lineStyle(type: LineType): string {
  return JSON.stringify({ lineType: type });
}

/** The line type stored in an item's `style`; unknown or missing values read as a phase line. */
export function lineTypeOf(style: string | null): LineType {
  if (!style) return 'phase-line';
  try {
    const value = (JSON.parse(style) as { lineType?: unknown }).lineType;
    return typeof value === 'string' && BY_ID.has(value as LineType) ? (value as LineType) : 'phase-line';
  } catch {
    return 'phase-line';
  }
}
