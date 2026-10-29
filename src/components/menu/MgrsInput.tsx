import { useEffect, useRef } from 'react';
import { Text, View, type NativeSyntheticEvent, type TextInput, type TextInputKeyPressEventData } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { splitMgrs, type MgrsParts } from '@/lib/geo/coords/mgrs';
import { useTheme } from '@/theme/ThemeProvider';

import { fieldBefore, type MgrsField, type MgrsFieldStatus } from './mgrs-fields';

type Props = {
  value: MgrsParts;
  onChange: (parts: MgrsParts) => void;
  status: MgrsFieldStatus;
  /** Extra text after "Valid ·", e.g. range and bearing from the user. */
  validDetail?: string;
  /** Read-only: the fields show the reference but cannot be edited. */
  disabled?: boolean;
  /** Return in the northing field (e.g. add the typed point). Without it there is no return key (no iOS Done bar). */
  onSubmit?: () => void;
  /** Focus this field once on mount (quick plot). */
  autoFocus?: 'zone' | 'easting';
  /** Smaller field corners, to nest inside a card with 8 pt padding (quick plot). */
  nested?: boolean;
  /** Show the validation line under the fields (default). Off when the caller renders its own status. */
  showStatus?: boolean;
};

// Widths (pt) that show '18S' and 'UJ' in full at the 18 pt mono font with dense padding.
const ZONE_WIDTH = 56;
const SQUARE_WIDTH = 46;
/** Five 18 pt mono digits plus the dense field's padding and border, with a little slack for the cursor. */
const DIGIT_FIELD_MIN_WIDTH = 76;
const FIELD_GAP = 8;
/** The narrowest the grid row can be without cutting off digits (the landscape drawer must allow it). */
export const MGRS_ROW_MIN_WIDTH = ZONE_WIDTH + SQUARE_WIDTH + 2 * DIGIT_FIELD_MIN_WIDTH + 3 * FIELD_GAP;

const letters = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const digits = (s: string) => s.replace(/\D/g, '');

/** Four-field MGRS entry (zone+band, 100 km square, easting, northing) with a validation line. */
export function MgrsInput({ value, onChange, status, validDetail, disabled = false, onSubmit, autoFocus, nested = false, showStatus = true }: Props) {
  const { colors } = useTheme();
  const zone = useRef<TextInput>(null);
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

  // Focus once from code rather than with the native autoFocus prop: iOS re-applies autoFocus whenever it
  // rebuilds a field's view, which pulled focus back to Easting mid-tap and swallowed the first Plot press.
  useEffect(() => {
    if (autoFocus === 'zone') zone.current?.focus();
    else if (autoFocus === 'easting') easting.current?.focus();
    // Mount only: later changes to autoFocus must not move the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusField = (field: MgrsField) => {
    if (field === 'zone') zone.current?.focus();
    else if (field === 'square') square.current?.focus();
    else if (field === 'easting') easting.current?.focus();
    else northing.current?.focus();
  };
  /** Backspace in an empty field hops back to the previous one, so a whole grid can be erased in one go. */
  const hopBack = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, field: MgrsField, text: string) => {
    if (e.nativeEvent.key !== 'Backspace' || text !== '') return;
    const prev = fieldBefore(field);
    if (prev) focusField(prev);
  };
  const onSquareKey = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => hopBack(e, 'square', value.square);
  const onEastingKey = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => hopBack(e, 'easting', value.easting);
  const onNorthingKey = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => hopBack(e, 'northing', value.northing);

  const invalid = status.status === 'invalid';
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {/* Zone and square are fixed widths that fit their 3 and 2 characters; the digit fields share the rest. */}
        <View style={{ width: ZONE_WIDTH }}>
          <TextField nested={nested} editable={!disabled} ref={zone} mono dense accessibilityLabel="MGRS zone" value={value.zoneBand} onChangeText={onZone} autoCapitalize="characters" autoCorrect={false} invalid={invalid} placeholder="18S" />
        </View>
        <View style={{ width: SQUARE_WIDTH }}>
          <TextField nested={nested} editable={!disabled} ref={square} onKeyPress={onSquareKey} mono dense accessibilityLabel="100 km square" value={value.square} onChangeText={onSquare} autoCapitalize="characters" autoCorrect={false} maxLength={2} invalid={invalid} placeholder="UJ" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField nested={nested} editable={!disabled} ref={easting} onKeyPress={onEastingKey} mono dense accessibilityLabel="Easting" value={value.easting} onChangeText={onEasting} keyboardType="number-pad" maxLength={5} invalid={invalid} placeholder="00000" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField nested={nested} editable={!disabled} ref={northing} onKeyPress={onNorthingKey} mono dense accessibilityLabel="Northing" value={value.northing} onChangeText={onNorthing} keyboardType="number-pad" maxLength={5} invalid={invalid} placeholder="00000" returnKeyType={onSubmit ? 'done' : undefined} onSubmitEditing={onSubmit} />
        </View>
      </View>
      {showStatus && (status.status === 'valid' || status.status === 'invalid') ? (
        <View className="flex-row items-center gap-1">
          {status.status === 'valid' ? <Icon name="check" size={16} color={colors.success} /> : null}
          {status.status === 'invalid' ? <Icon name="alert-circle-outline" size={16} color={colors.danger} /> : null}
          <Text testID="mgrs-status" className="shrink text-sm text-text">
            {status.status === 'valid' ? (
              <>
                <Text className="text-success">Valid</Text>
                {validDetail ? ` · ${validDetail}` : ''}
              </>
            ) : (
              <Text className="text-danger">{status.message}</Text>
            )}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
