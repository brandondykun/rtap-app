import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useCommandContext } from '@/lib/db/command-context-provider';

import { createMission } from './commands';
import { MissionNameForm } from './MissionNameForm';
import { suggestMissionName } from './repository';

export function CreateMissionScreen() {
  const ctx = useCommandContext();
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  // A ref, not state: a second tap in the same frame must see the first tap's lock.
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    void suggestMissionName(ctx.db).then((suggestion) => {
      // Only prefill while the field is still empty (the user may already be typing).
      if (live) setName((current) => (current === '' ? suggestion : current));
    });
    return () => {
      live = false;
    };
  }, [ctx]);

  const submit = async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    const result = await createMission(ctx, { name });
    if (result.ok) {
      // Stay locked: the sheet is being replaced by the map.
      router.replace({ pathname: '/missions/[missionId]', params: { missionId: result.value.id } });
      return;
    }
    busy.current = false;
    setError(result.error === 'invalid_name' ? 'Enter a mission name.' : 'Could not create the mission. Try again.');
  };

  return (
    <MissionNameForm
      title="New mission"
      name={name}
      onChangeName={setName}
      submitLabel="Create"
      onSubmit={() => void submit()}
      onCancel={() => router.back()}
      error={error}
    />
  );
}
