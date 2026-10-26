import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';
import { ENEMY_UNIT } from '@/stores/draft';

import { AddItemPanel } from './AddItemPanel';
import { UnitForm } from './UnitForm';

export function AddUnitMenu({ params, missionId }: MenuComponentProps<'unit.add'>) {
  return <AddItemPanel category="unit" at={params.at} unitPreset={params.enemy ? ENEMY_UNIT : undefined} missionId={missionId} form={<UnitForm missionId={missionId} mode="add" />} />;
}

export const addUnitMenu = defineMenu({ id: 'unit.add', family: 'action', title: 'Add unit', icon: 'rhombus-outline', component: AddUnitMenu });
