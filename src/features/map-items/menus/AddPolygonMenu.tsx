import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';

import { AddItemPanel } from './AddItemPanel';
import { PolygonForm } from './PolygonForm';

export function AddPolygonMenu({ missionId }: MenuComponentProps<'polygon.add'>) {
  return <AddItemPanel category="polygon" missionId={missionId} form={<PolygonForm />} />;
}

export const addPolygonMenu = defineMenu({ id: 'polygon.add', family: 'action', title: 'Add polygon', detents: ['peek', 'half', 'full'], component: AddPolygonMenu });
