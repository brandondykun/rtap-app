import { Image, View } from 'react-native';

import { useSymbolThumbnail } from './render/use-symbol-thumbnail';

/** A symbol thumbnail at a fixed box size; an empty box of the same size while it renders. */
export function SymbolImage({ sidc, width, height }: { sidc: string; width: number; height: number }) {
  const source = useSymbolThumbnail(sidc);
  return source ? <Image testID={`symbol-${sidc}`} source={source} style={{ width, height }} resizeMode="contain" /> : <View style={{ width, height }} />;
}
