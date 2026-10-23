import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { OutlinedText } from './OutlinedText';

const colors = themeColors('dark');

describe('OutlinedText', () => {
  it('draws the text in its color over dark copies shifted one point each way', async () => {
    await renderWithProviders(
      <OutlinedText testID="t" color={colors.friendly}>
        18S UJ 12345 67890
      </OutlinedText>,
    );
    expect(screen.getByTestId('t')).toHaveStyle({ color: colors.friendly });
    const copies = screen.getAllByTestId('text-outline', { includeHiddenElements: true });
    expect(copies).toHaveLength(8);
    const shifts = copies.map((c) => {
      const s = StyleSheet.flatten(c.props.style);
      expect(s.color).toBe(colors['point-symbol-halo']);
      expect(c).toHaveTextContent('18S UJ 12345 67890');
      return s.transform.map((t: Record<string, number>) => Object.values(t)[0]).join(',');
    });
    expect(new Set(shifts)).toEqual(new Set(['-1,-1', '0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1', '1,1']));
  });

  it('shrinks every copy to fit the same way as the text', async () => {
    await renderWithProviders(
      <OutlinedText testID="t" color={colors.friendly} adjustsFontSizeToFit numberOfLines={1} className="font-mono-bold text-lg">
        18S UJ 12345 67890
      </OutlinedText>,
    );
    for (const el of [screen.getByTestId('t'), ...screen.getAllByTestId('text-outline', { includeHiddenElements: true })]) {
      expect(el.props.adjustsFontSizeToFit).toBe(true);
      expect(el.props.numberOfLines).toBe(1);
      expect(el.props.className).toContain('font-mono-bold text-lg');
    }
  });

  it('hides the copies from screen readers, so the text is read once', async () => {
    await renderWithProviders(<OutlinedText testID="t" color={colors.friendly}>18S</OutlinedText>);
    expect(screen.queryAllByTestId('text-outline')).toHaveLength(0);
    expect(screen.getByTestId('t')).toBeOnTheScreen();
  });
});
