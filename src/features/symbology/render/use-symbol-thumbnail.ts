import { useEffect, useState } from 'react';

import { getSymbolImage } from './get-symbol-image';

/** A symbol for menus and lists (points cropped to their graphic); null while it renders. */
export function useSymbolThumbnail(sidc: string): { uri: string } | null {
  const [image, setImage] = useState<{ uri: string } | null>(null);
  useEffect(() => {
    let live = true;
    void getSymbolImage(sidc, { trimmed: true }).then((img) => {
      if (live) setImage(img ? { uri: img.uri } : null);
    });
    return () => {
      live = false;
    };
  }, [sidc]);
  return image;
}
