import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';

import { AddItemPanel } from './AddItemPanel';
import { LineForm } from './LineForm';

export function AddLineMenu({ missionId }: MenuComponentProps<'line.add'>) {
  return <AddItemPanel category="line" missionId={missionId} form={<LineForm missionId={missionId} mode="add" />} />;
}
export const addLineMenu = defineMenu({ id: 'line.add', family: 'action', title: 'Add line', icon: 'vector-polyline', detents: ['peek', 'half', 'full'], component: AddLineMenu });
