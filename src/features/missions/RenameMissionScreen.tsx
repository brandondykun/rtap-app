import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { notifySuccess } from '@/features/feedback/feedback';
import { useCommandContext } from '@/lib/db/command-context-provider';

import { renameMission } from './commands';
import { MissionNameForm } from './MissionNameForm';
import { findMission } from './repository';

export function RenameMissionScreen({ missionId }: { missionId: string }) {
  const ctx = useCommandContext();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    void findMission(ctx.db, missionId).then((mission) => {
      if (!live) return;
      // Deleted (or unknown) while the sheet opened: nothing to rename.
      if (mission) setName(mission.name);
      else router.back();
    });
    return () => {
      live = false;
    };
  }, [ctx, missionId, router]);

  const submit = async () => {
    if (busy.current || name === null) return;
    busy.current = true;
    setError(null);
    const result = await renameMission(ctx, missionId, { name });
    if (result.ok || result.error === 'not_found') {
      if (result.ok) notifySuccess();
      router.back();
      return;
    }
    busy.current = false;
    setError(result.error === 'invalid_name' ? 'Enter a mission name.' : 'Could not rename the mission. Try again.');
  };

  // Mount the field only once the name is known, so autoFocus selects the prefilled text.
  if (name === null) return null;
  return (
    <MissionNameForm
      title="Rename mission"
      name={name}
      onChangeName={setName}
      submitLabel="Save"
      onSubmit={() => void submit()}
      onCancel={() => router.back()}
      error={error}
    />
  );
}
