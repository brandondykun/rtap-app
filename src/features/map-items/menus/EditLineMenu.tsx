import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';

import { EditItemPanel } from './EditItemPanel';
import { LineForm } from './LineForm';

export function EditLineMenu({ params, missionId }: MenuComponentProps<'line.edit'>) {
  return <EditItemPanel category="line" itemId={params.itemId} missionId={missionId} form={<LineForm missionId={missionId} mode="edit" />} />;
}
export const editLineMenu = defineMenu({ id: 'line.edit', family: 'action', title: 'Edit line', icon: 'vector-polyline', detents: ['peek', 'half', 'full'], component: EditLineMenu });
