import { screen, within } from '@testing-library/react-native';

/** The labels of an open MenuSelect's options, in the order shown. */
export function selectOptionLabels(): string[] {
  return within(screen.getByTestId('menu-select-options'))
    .getAllByRole('button')
    .map((b) => within(b).getAllByText(/.+/)[0].props.children as string);
}
