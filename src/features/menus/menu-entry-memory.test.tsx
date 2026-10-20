import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { INITIAL_MENU, topMenu, useMenu } from '@/stores/menu';

import { recallForEntry, rememberForEntry, useMenuEntryState } from './menu-entry-memory';

beforeEach(() => useMenu.setState(INITIAL_MENU));

function Counter() {
  const [n, setN] = useMenuEntryState('n', 0);
  return (
    <Pressable accessibilityRole="button" onPress={() => setN(n + 1)}>
      <Text>{`count ${n}`}</Text>
    </Pressable>
  );
}

describe('menu entry memory', () => {
  it('keeps a value per menu entry: a drilled-in menu and back finds it again', () => {
    useMenu.getState().openMenu('layers', {});
    const layers = topMenu(useMenu.getState())!;
    rememberForEntry(layers, 'scrollY', 240);
    useMenu.getState().pushMenu('unit.edit', { itemId: 'u1' });
    expect(recallForEntry(topMenu(useMenu.getState())!, 'scrollY')).toBeUndefined();
    useMenu.getState().back();
    expect(recallForEntry(topMenu(useMenu.getState())!, 'scrollY')).toBe(240);
  });

  it('forgets it when the menu is opened afresh', () => {
    useMenu.getState().openMenu('layers', {});
    rememberForEntry(topMenu(useMenu.getState())!, 'scrollY', 240);
    useMenu.getState().closeMenu();
    useMenu.getState().openMenu('layers', {});
    expect(recallForEntry(topMenu(useMenu.getState())!, 'scrollY')).toBeUndefined();
  });

  it('gives a menu component state that comes back with it', async () => {
    useMenu.getState().openMenu('layers', {});
    const first = await render(<Counter />);
    await fireEvent.press(screen.getByRole('button'));
    expect(screen.getByText('count 1')).toBeTruthy();
    await first.unmount();
    // Back on the same entry: the count is still 1.
    await render(<Counter />);
    expect(screen.getByText('count 1')).toBeTruthy();
    // A fresh Layers starts over.
    await act(async () => useMenu.getState().openMenu('layers', {}));
    await render(<Counter />);
    expect(screen.getAllByText(/count/).map((t) => t.props.children)).toContain('count 0');
  });
});
