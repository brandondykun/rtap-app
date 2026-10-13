import { INITIAL_MENU, topMenu, useMenu } from './menu';

beforeEach(() => useMenu.setState(INITIAL_MENU));

describe('menu store', () => {
  it('opens a menu, replacing the stack', () => {
    useMenu.getState().openMenu('settings', {});
    useMenu.getState().openMenu('unit.edit', { itemId: 'a' });
    expect(useMenu.getState().stack).toEqual([{ id: 'unit.edit', params: { itemId: 'a' } }]);
  });

  it('pushes and goes back', () => {
    useMenu.getState().openMenu('app.root', {});
    useMenu.getState().pushMenu('settings', {});
    expect(topMenu(useMenu.getState())?.id).toBe('settings');
    useMenu.getState().back();
    expect(topMenu(useMenu.getState())?.id).toBe('app.root');
    useMenu.getState().back();
    expect(topMenu(useMenu.getState())).toBeNull();
  });

  it('closes everything', () => {
    useMenu.getState().openMenu('app.root', {});
    useMenu.getState().pushMenu('settings', {});
    useMenu.getState().closeMenu();
    expect(useMenu.getState().stack).toEqual([]);
  });

  it('accepts an optional press coordinate for unit.add', () => {
    expect(useMenu.getState().openMenu('unit.add', { at: { lat: 38.9, lon: -77 } })).toBe(true);
    expect(useMenu.getState().openMenu('unit.add', {})).toBe(true);
  });

  it.each([
    ['unit.edit', { itemId: '' }],
    ['unit.add', { at: { lat: 95, lon: 0 } }],
    ['unit.edit', {}],
  ] as const)('rejects invalid params for %s and keeps the stack', (id, params) => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    useMenu.getState().openMenu('settings', {});
    expect(useMenu.getState().openMenu(id, params as never)).toBe(false);
    expect(topMenu(useMenu.getState())?.id).toBe('settings');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('stores the panel frame', () => {
    useMenu.getState().setPanelFrame({ side: 'bottom', size: 320 });
    expect(useMenu.getState().panelFrame).toEqual({ side: 'bottom', size: 320 });
  });

  it('keeps the same panelFrame reference for an equal frame', () => {
    useMenu.getState().setPanelFrame({ side: 'bottom', size: 320 });
    const first = useMenu.getState().panelFrame;
    useMenu.getState().setPanelFrame({ side: 'bottom', size: 320 });
    expect(useMenu.getState().panelFrame).toBe(first);
    useMenu.getState().setPanelFrame({ side: 'bottom', size: 400 });
    expect(useMenu.getState().panelFrame).not.toBe(first);
  });

  it('treats null over null as a no-op', () => {
    const listener = jest.fn();
    const unsubscribe = useMenu.subscribe(listener);
    useMenu.getState().setPanelFrame(null);
    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
    expect(useMenu.getState().panelFrame).toBeNull();
  });
});
