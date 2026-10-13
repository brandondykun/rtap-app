import { useEffect } from 'react';

import { useCommandContext } from '@/lib/db/command-context-provider';
import { useDraft, type DraftMode } from '@/stores/draft';

import { suggestName } from '../../repository';

/** In add mode, fills an empty, untyped name with the next `<prefix>-n` for the mission. */
export function useAutoName(missionId: string, mode: DraftMode, prefix: string): void {
  const ctx = useCommandContext();
  const needsName = useDraft((s) => mode === 'add' && !s.nameEdited && s.name === '');
  useEffect(() => {
    if (!needsName) return;
    let live = true;
    void suggestName(ctx.db, missionId, prefix).then((suggestion) => {
      // The prefix may have changed (type or affiliation switched) while the query ran.
      if (live && suggestion.startsWith(`${prefix}-`)) useDraft.getState().setAutoName(suggestion);
    });
    return () => {
      live = false;
    };
  }, [needsName, prefix, ctx, missionId]);
}
