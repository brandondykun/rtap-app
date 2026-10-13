import { useToast } from './toast';

beforeEach(() => useToast.setState({ toast: null }));

describe('toast store', () => {
  it('shows a toast with a fresh id', () => {
    useToast.getState().show('Boom');
    const first = useToast.getState().toast;
    expect(first).toMatchObject({ message: 'Boom', kind: 'error' });
    useToast.getState().show('Hello', 'info');
    expect(useToast.getState().toast?.id).not.toBe(first?.id);
  });

  it('hides only the toast it was asked to hide', () => {
    useToast.getState().show('Old');
    const old = useToast.getState().toast!.id;
    useToast.getState().show('New');
    useToast.getState().hide(old);
    expect(useToast.getState().toast?.message).toBe('New');
    useToast.getState().hide();
    expect(useToast.getState().toast).toBeNull();
  });
});
