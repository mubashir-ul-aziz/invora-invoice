import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { useCurrencySymbol } from '@/state/currencyContext';

interface Props {
  size: number;
  color: string;
  style?: StyleProp<TextStyle>;
}

/**
 * A money glyph in the current currency (see `currencyContext`) — Feather's
 * `dollar-sign` for `$` currencies, otherwise the currency's own symbol
 * (`€`, `£`, `₹`, …) drawn as text at the same footprint, so a EUR invoice's
 * "Record Payment" never shows a dollar icon.
 */
export function CurrencyIcon({ size, color, style }: Props) {
  const symbol = useCurrencySymbol();
  if (symbol === '$') {
    return <Feather name="dollar-sign" size={size} color={color} style={style} />;
  }
  return (
    <Text
      style={[styles.symbol, { color, fontSize: symbol.length > 1 ? size * 0.7 : size, lineHeight: size * 1.2, minWidth: size }, style]}
      numberOfLines={1}
      accessible={false}
    >
      {symbol}
    </Text>
  );
}

const styles = StyleSheet.create({
  symbol: { fontWeight: '700', textAlign: 'center' },
});

/** A Feather glyph name, or `'currency'` for `CurrencyIcon` — for icon props on money-related tiles/rows/buttons. */
export type GlyphName = keyof typeof Feather.glyphMap | 'currency';

/** Renders a `GlyphName`: `CurrencyIcon` for `'currency'`, the Feather glyph otherwise. */
export function Glyph({ name, size, color, style }: Props & { name: GlyphName }) {
  if (name === 'currency') {
    return <CurrencyIcon size={size} color={color} style={style} />;
  }
  return <Feather name={name} size={size} color={color} style={style} />;
}
