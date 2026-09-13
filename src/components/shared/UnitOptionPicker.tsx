import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { OptionPicker } from '@/components/business/OptionPicker';
import { ActionButton } from '@/components/businessCard/ActionButton';
import { FormField } from '@/components/businessCard/FormField';
import { baseUnitOptionsFor, mergeUnitOptions, type UnitFieldKind } from '@/domain/invoiceType/customUnits';
import { useCustomUnitsStore } from '@/state/customUnitsStore';
import { colors } from '@/theme/colors';

/** Sentinel chip value that opens the "Add custom unit" prompt instead of selecting a real unit. */
const ADD_CUSTOM_UNIT = '__add_custom_unit__';

interface Props {
  label: string;
  /** Which unit dropdown this is — decides the fixed base options and which business-added list to read/extend. */
  kind: UnitFieldKind;
  value: string;
  onChange: (value: string) => void;
  testID?: string;
}

/**
 * A unit dropdown that always offers "+ Add custom unit" alongside the fixed
 * catalog (`baseUnitOptionsFor`) and any units this business already added —
 * used everywhere a Unit/Weight unit/Dimension unit/Time unit is picked (item
 * catalog, invoice lines). Picking "+ Add custom unit" opens a small prompt;
 * saving it persists the unit via `customUnitsStore` (so it's available next
 * time, for every field of this kind — see `BusinessRepository.addCustomUnit`)
 * and immediately selects it.
 */
export function UnitOptionPicker({ label, kind, value, onChange, testID }: Props) {
  const { units, load, addUnit } = useCustomUnitsStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | undefined>(undefined);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseOptions = baseUnitOptionsFor(kind);
  const options = mergeUnitOptions(baseOptions, units[kind] ?? []);

  const handleChange = (selected: string) => {
    if (selected === ADD_CUSTOM_UNIT) {
      setDraft('');
      setDraftError(undefined);
      setModalOpen(true);
      return;
    }
    onChange(selected);
  };

  const closeModal = () => {
    setModalOpen(false);
    setDraftError(undefined);
  };

  const handleSaveCustomUnit = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraftError('Enter a unit name.');
      return;
    }
    await addUnit(kind, trimmed);
    onChange(trimmed);
    closeModal();
  };

  return (
    <>
      <OptionPicker
        label={label}
        options={[...options, { value: ADD_CUSTOM_UNIT, label: '+ Add custom unit' }]}
        value={value}
        onChange={handleChange}
        testID={testID}
      />

      <Modal transparent animationType="fade" visible={modalOpen} onRequestClose={closeModal}>
        <Pressable style={styles.backdrop} onPress={closeModal} testID={testID ? `${testID}-custom-backdrop` : undefined}>
          {/* Swallow taps inside the sheet so they don't fall through to the backdrop's dismiss handler. */}
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Add custom unit</Text>
            <FormField
              label="Unit name"
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                setDraftError(undefined);
              }}
              error={draftError}
              placeholder="e.g. roll, sqft, bag"
              autoFocus
              testID={testID ? `${testID}-custom-input` : undefined}
            />
            <View style={styles.sheetActions}>
              <ActionButton label="Cancel" onPress={closeModal} testID={testID ? `${testID}-custom-cancel` : undefined} />
              <ActionButton
                label="Add"
                variant="primary"
                onPress={handleSaveCustomUnit}
                testID={testID ? `${testID}-custom-save` : undefined}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});
