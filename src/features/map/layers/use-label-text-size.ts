import { useSettings } from '@/stores/settings';

import { LABEL_TEXT_SIZES } from './styles';

/** Item label text size in pt, from the Label text size setting. */
export function useLabelTextSize(): number {
  return useSettings((s) => LABEL_TEXT_SIZES[s.labelSize]);
}
