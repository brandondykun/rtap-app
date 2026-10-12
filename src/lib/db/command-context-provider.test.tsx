import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CommandContextProvider, useCommandContext } from './command-context-provider';
import { makeTestContext } from './test-database';

function Probe() {
  return <Text>{useCommandContext().actorId()}</Text>;
}

describe('CommandContextProvider', () => {
  it('provides the command context', async () => {
    await render(
      <CommandContextProvider value={makeTestContext()}>
        <Probe />
      </CommandContextProvider>,
    );
    expect(screen.getByText('device-test')).toBeTruthy();
  });

  it('throws outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Probe />)).rejects.toThrow('useCommandContext must be used inside CommandContextProvider');
  });
});
