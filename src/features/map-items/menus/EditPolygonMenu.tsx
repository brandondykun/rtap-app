import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';

import { EditItemPanel } from './EditItemPanel';
import { PolygonForm } from './PolygonForm';

export function EditPolygonMenu({ params, missionId }: MenuComponentProps<'polygon.edit'>) {
  return <EditItemPanel category="polygon" itemId={params.itemId} missionId={missionId} form={<PolygonForm missionId={missionId} mode="edit" />} />;
}

export const editPolygonMenu = defineMenu({ id: 'polygon.edit', family: 'action', title: 'Edit polygon', icon: 'pentagon-outline', detents: ['peek', 'half', 'full'], component: EditPolygonMenu });
