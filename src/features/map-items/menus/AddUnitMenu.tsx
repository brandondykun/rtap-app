import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';

import { AddItemPanel } from './AddItemPanel';
import { UnitForm } from './UnitForm';

export function AddUnitMenu({ params, missionId }: MenuComponentProps<'unit.add'>) {
  return <AddItemPanel category="unit" at={params.at} affiliation={params.affiliation} missionId={missionId} form={<UnitForm missionId={missionId} mode="add" />} />;
}

export const addUnitMenu = defineMenu({ id: 'unit.add', family: 'action', title: 'Add unit', detents: ['peek', 'half', 'full'], component: AddUnitMenu });
