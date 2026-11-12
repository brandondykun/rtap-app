import { useSettings } from '@/stores/settings';

import { SYMBOL_SCALES } from './styles';

/** Unit and point symbol scale, from the Symbol size setting (1 is the original size). */
export function useSymbolScale(): number {
  return useSettings((s) => SYMBOL_SCALES[s.symbolSize]);
}
