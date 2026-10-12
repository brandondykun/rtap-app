import { createContext, use, type ReactNode } from 'react';

import type { CommandContext } from './command-context';

const Context = createContext<CommandContext | null>(null);

/** Supplies the database and identity to screens; tests pass an in-memory context. */
export function CommandContextProvider({ value, children }: { value: CommandContext; children: ReactNode }) {
  return <Context value={value}>{children}</Context>;
}

export function useCommandContext(): CommandContext {
  const value = use(Context);
  if (!value) throw new Error('useCommandContext must be used inside CommandContextProvider');
  return value;
}
