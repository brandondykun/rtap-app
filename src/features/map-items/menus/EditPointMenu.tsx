import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';

import { EditItemPanel } from './EditItemPanel';
import { PointForm } from './PointForm';

export function EditPointMenu({ params, missionId }: MenuComponentProps<'point.edit'>) {
  return <EditItemPanel category="point" itemId={params.itemId} missionId={missionId} form={<PointForm missionId={missionId} mode="edit" />} />;
}

export const editPointMenu = defineMenu({ id: 'point.edit', family: 'action', title: 'Edit point', detents: ['peek', 'half', 'full'], component: EditPointMenu });
