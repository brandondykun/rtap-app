import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BehaviorSubject, Subject } from 'rxjs';

import { useObservable, useRememberedObservable } from './use-observable';

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

function Remembered({ scope, name, source }: { scope: object; name: string; source: BehaviorSubject<number> | Subject<number> }) {
  const value = useRememberedObservable(scope, name, () => source, -1, [source]);
  return <Text>{`v:${value}`}</Text>;
}

describe('useRememberedObservable', () => {
  it('opens again with the last value seen, until the query answers again', async () => {
    const scope = {};
    const first = new BehaviorSubject(3);
    const { unmount } = await render(<Remembered scope={scope} name="k" source={first} />);
    expect(screen.getByText('v:3')).toBeTruthy();
    await unmount();
    // A query that has not answered yet: what was seen last, not the empty start.
    const slow = new Subject<number>();
    await render(<Remembered scope={scope} name="k" source={slow} />);
    expect(screen.getByText('v:3')).toBeTruthy();
    await act(async () => slow.next(4));
    expect(screen.getByText('v:4')).toBeTruthy();
  });

  it('starts from the initial value for a key or a scope it has not seen', async () => {
    const scope = {};
    await render(<Remembered scope={scope} name="a" source={new BehaviorSubject(1)} />);
    expect(screen.getByText('v:1')).toBeTruthy();
    await render(<Remembered scope={scope} name="b" source={new Subject<number>()} />);
    expect(screen.getByText('v:-1')).toBeTruthy();
    await render(<Remembered scope={{}} name="a" source={new Subject<number>()} />);
    expect(screen.getByText('v:-1')).toBeTruthy();
  });
});
