import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BehaviorSubject } from 'rxjs';

import { useObservable } from './use-observable';

function Probe({ source }: { source: BehaviorSubject<number> }) {
  const value = useObservable(() => source, -1, [source]);
  return <Text>{`v:${value}`}</Text>;
}

describe('useObservable', () => {
  it('renders emitted values and unsubscribes on unmount', async () => {
    const source = new BehaviorSubject(1);
    const { unmount } = await render(<Probe source={source} />);
    expect(screen.getByText('v:1')).toBeTruthy();
    await act(async () => source.next(2));
    expect(screen.getByText('v:2')).toBeTruthy();
    await unmount();
    expect(source.observed).toBe(false);
  });
});
