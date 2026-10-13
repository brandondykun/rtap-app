import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';

import { EditItemPanel } from './EditItemPanel';
import { UnitForm } from './UnitForm';

export function EditUnitMenu({ params, missionId }: MenuComponentProps<'unit.edit'>) {
  return <EditItemPanel category="unit" itemId={params.itemId} missionId={missionId} form={<UnitForm missionId={missionId} mode="edit" />} />;
}

export const editUnitMenu = defineMenu({ id: 'unit.edit', family: 'action', title: 'Edit unit', detents: ['peek', 'half', 'full'], component: EditUnitMenu });
