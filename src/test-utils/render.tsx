import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import type { CommandContext } from '@/lib/db/command-context';
import { CommandContextProvider } from '@/lib/db/command-context-provider';
import { makeTestContext } from '@/lib/db/test-database';
import { ThemeProvider } from '@/theme/ThemeProvider';

/** Renders with the dark theme and an in-memory command context (fresh unless given). */
export async function renderWithProviders(ui: ReactElement, ctx: CommandContext = makeTestContext()) {
  const result = await render(
    <CommandContextProvider value={ctx}>
      <ThemeProvider theme="dark">{ui}</ThemeProvider>
    </CommandContextProvider>,
  );
  return { ...result, ctx };
}
