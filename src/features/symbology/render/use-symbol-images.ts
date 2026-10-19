import { useCallback, useEffect, useRef, useState } from 'react';

import { isKnownSidc } from '@/features/symbology/categories';

import { getSymbolImage } from './get-symbol-image';

type Entry = { url: string; scale: number };

/**
 * Mapbox image entries for symbols, by SIDC. Resolves `sidcs` (the mission's) and anything the map
 * reports missing; the record only changes identity when a new symbol arrives (stable `<Images>`).
 */
export function useSymbolImages(sidcs: readonly string[]): { images: Record<string, Entry>; request: (sidc: string) => void } {
  const [images, setImages] = useState<Record<string, Entry>>({});
  const [extra, setExtra] = useState<readonly string[]>([]);
  const requested = useRef(new Set<string>());
  // The map also reports its own images (label-chip, self, draft-ring…) missing while they load: never draw
  // those. A symbol already being drawn (or drawn) needs no second request either.
  const request = useCallback((sidc: string) => {
    if (!isKnownSidc(sidc) || requested.current.has(sidc)) return;
    setExtra((e) => (e.includes(sidc) ? e : [...e, sidc]));
  }, []);
  const key = [...new Set([...sidcs, ...extra])].sort().join('|');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const wanted = key ? key.split('|') : [];
    for (const sidc of wanted) {
      if (requested.current.has(sidc)) continue;
      requested.current.add(sidc);
      void getSymbolImage(sidc).then((img) => {
        if (!mounted.current) return;
        if (!img) {
          // Cannot be drawn now: allow a later change of the wanted set to retry it.
          requested.current.delete(sidc);
          return;
        }
        setImages((cur) => (cur[sidc]?.url === img.uri ? cur : { ...cur, [sidc]: { url: img.uri, scale: img.scale } }));
      });
    }
  }, [key]);

  return { images, request };
}
