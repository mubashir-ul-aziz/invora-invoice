import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export interface OverflowMenuItem {
  label: string;
  onPress: () => void;
  /** Renders the label in the danger color (e.g. "Delete"). */
  destructive?: boolean;
  testID?: string;
}

/**
 * Compact "⋮" trigger for secondary actions that would otherwise crowd a
 * screen as standalone buttons (Edit, Duplicate, Download PDF, Delete, …).
 * See `InvoiceDetailScreen` for the reference usage.
 */
export function OverflowMenu({ items, testID }: { items: OverflowMenuItem[]; testID?: string }) {
  const [open, setOpen] = useState(false);

  const select = (item: OverflowMenuItem) => {
    setOpen(false);
    item.onPress();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="More actions"
        testID={testID ?? 'overflow-menu-trigger'}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <Feather name="more-vertical" size={20} color={colors.text} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          testID="overflow-menu-backdrop"
        >
          <View style={styles.menu}>
            {items.map((item, index) => (
              <Pressable
                key={item.label}
                onPress={() => select(item)}
                testID={item.testID}
                style={({ pressed }) => [
                  styles.menuItem,
                  index > 0 && styles.menuItemBorder,
                  pressed && styles.menuItemPressed,
                ]}
              >
                <Text style={[styles.menuItemLabel, item.destructive && styles.menuItemDestructive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  triggerPressed: { backgroundColor: colors.background },
  backdrop: { flex: 1, alignItems: 'flex-end' },
  menu: {
    marginTop: 8,
    marginRight: 12,
    minWidth: 190,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  menuItem: { paddingVertical: 13, paddingHorizontal: 16 },
  menuItemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  menuItemPressed: { backgroundColor: colors.background },
  menuItemLabel: { fontSize: 15, fontWeight: '500', color: colors.text },
  menuItemDestructive: { color: colors.danger },
});
