import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';

import { AddItemPanel } from './AddItemPanel';
import { LineForm } from './LineForm';

export function AddLineMenu({ missionId }: MenuComponentProps<'line.add'>) {
  return <AddItemPanel category="line" missionId={missionId} form={<LineForm />} />;
}
export const addLineMenu = defineMenu({ id: 'line.add', family: 'action', title: 'Add line', detents: ['peek', 'half', 'full'], component: AddLineMenu });
