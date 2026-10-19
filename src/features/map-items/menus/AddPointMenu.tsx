import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';

import { AddItemPanel } from './AddItemPanel';
import { PointForm } from './PointForm';

export function AddPointMenu({ params, missionId }: MenuComponentProps<'point.add'>) {
  return <AddItemPanel category="point" at={params.at} missionId={missionId} form={<PointForm missionId={missionId} mode="add" />} />;
}

export const addPointMenu = defineMenu({ id: 'point.add', family: 'action', title: 'Add point', icon: 'map-marker-outline', detents: ['peek', 'half', 'full'], component: AddPointMenu });
