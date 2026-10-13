import { useRef } from 'react';
import { Text, View, type TextInput } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { splitMgrs, type MgrsParts } from '@/lib/geo/coords/mgrs';
import { useTheme } from '@/theme/ThemeProvider';

import type { MgrsFieldStatus } from './mgrs-fields';
import { MenuTextField } from './MenuTextField';

type Props = {
  value: MgrsParts;
  onChange: (parts: MgrsParts) => void;
  status: MgrsFieldStatus;
  /** Extra text after "Valid ·", e.g. range and bearing from the user. */
  validDetail?: string;
};

// Widths (pt) that show '18S' and 'UJ' in full at the 18 pt mono font with dense padding.
const ZONE_WIDTH = 64;
const SQUARE_WIDTH = 54;

const letters = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const digits = (s: string) => s.replace(/\D/g, '');

/** Four-field MGRS entry (zone+band, 100 km square, easting, northing) with a validation line. */
export function MgrsInput({ value, onChange, status, validDetail }: Props) {
  const { colors } = useTheme();
  const square = useRef<TextInput>(null);
  const easting = useRef<TextInput>(null);
  const northing = useRef<TextInput>(null);

  const onZone = (text: string) => {
    // A whole reference pasted (or typed) into the first field is spread across all four.
    if (letters(text).length > 3) {
      const parts = splitMgrs(text);
      if (parts.ok) {
        onChange(parts.value);
        return;
      }
    }
    const zoneBand = letters(text).slice(0, 3);
    onChange({ ...value, zoneBand });
    if (/^\d{1,2}[A-Z]$/.test(zoneBand)) square.current?.focus();
  };
  const onSquare = (text: string) => {
    const next = letters(text).replace(/\d/g, '').slice(0, 2);
    onChange({ ...value, square: next });
    if (next.length === 2) easting.current?.focus();
  };
  const onEasting = (text: string) => {
    const next = digits(text).slice(0, 5);
    onChange({ ...value, easting: next });
    if (next.length === 5) northing.current?.focus();
  };
  const onNorthing = (text: string) => onChange({ ...value, northing: digits(text).slice(0, 5) });

  const invalid = status.status === 'invalid';
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {/* Zone and square are fixed widths that fit their 3 and 2 characters; the digit fields share the rest. */}
        <View style={{ width: ZONE_WIDTH }}>
          <MenuTextField mono dense accessibilityLabel="MGRS zone" value={value.zoneBand} onChangeText={onZone} autoCapitalize="characters" autoCorrect={false} invalid={invalid} placeholder="18S" />
        </View>
        <View style={{ width: SQUARE_WIDTH }}>
          <MenuTextField ref={square} mono dense accessibilityLabel="100 km square" value={value.square} onChangeText={onSquare} autoCapitalize="characters" autoCorrect={false} maxLength={2} invalid={invalid} placeholder="UJ" />
        </View>
        <View style={{ flex: 1 }}>
          <MenuTextField ref={easting} mono dense accessibilityLabel="Easting" value={value.easting} onChangeText={onEasting} keyboardType="number-pad" maxLength={5} invalid={invalid} placeholder="00000" />
        </View>
        <View style={{ flex: 1 }}>
          <MenuTextField ref={northing} mono dense accessibilityLabel="Northing" value={value.northing} onChangeText={onNorthing} keyboardType="number-pad" maxLength={5} invalid={invalid} placeholder="00000" />
        </View>
      </View>
      <View className="flex-row items-center gap-1">
        {status.status === 'valid' ? <Icon name="check" size={16} color={colors.success} /> : null}
        {status.status === 'invalid' ? <Icon name="alert-circle-outline" size={16} color={colors.danger} /> : null}
        <Text testID="mgrs-status" className="shrink text-sm text-text-muted">
          {status.status === 'valid' ? (
            <>
              <Text className="text-success">Valid</Text>
              {validDetail ? ` · ${validDetail}` : ''}
            </>
          ) : status.status === 'invalid' ? (
            <Text className="text-danger">{status.message}</Text>
          ) : (
            'Enter zone, square, easting and northing'
          )}
        </Text>
      </View>
    </View>
  );
}
