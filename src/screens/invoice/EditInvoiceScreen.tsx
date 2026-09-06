import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import type { Customer } from '@/domain/customer/types';
import type { Invoice } from '@/domain/invoice/types';
import type { RootStackParamList } from '@/navigation/types';
import { useCustomerStore } from '@/state/customerStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceStore } from '@/state/invoiceStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'EditInvoice'>;

function customerFromInvoiceSnapshot(invoice: Invoice): Customer {
  return {
    id: invoice.customerId,
    name: invoice.customerName,
    phone: null,
    email: null,
    address: null,
    notes: null,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

type LoadStatus = 'loading' | 'error' | 'not-found';

/**
 * A thin loader: seeds `invoiceDraftStore` (`startEdit`) from the existing
 * invoice, then hands off to `CreateInvoiceItemsScreen` — the same
 * items-editing UI Create Invoice uses — via `replace()` so the back button
 * from there returns to Invoice Detail, not to this loading screen.
 */
export function EditInvoiceScreen({ navigation, route }: Props) {
  const { invoiceId } = route.params;
  const { getById: getInvoice } = useInvoiceStore();
  const { getById: getCustomer } = useCustomerStore();
  const [status, setStatus] = useState<LoadStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const invoice = await getInvoice(invoiceId);
        if (cancelled) {
          return;
        }
        if (!invoice) {
          setStatus('not-found');
          return;
        }
        const customer = (await getCustomer(invoice.customerId)) ?? customerFromInvoiceSnapshot(invoice);
        if (cancelled) {
          return;
        }
        useInvoiceDraftStore.getState().startEdit(invoice, customer);
        navigation.replace('CreateInvoiceItems');
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  if (status === 'not-found') {
    return (
      <View style={styles.centered} testID="edit-invoice-not-found">
        <Text style={styles.errorText}>This invoice no longer exists.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered} testID="edit-invoice-error">
        <Text style={styles.errorText}>Couldn't load this invoice.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={styles.centered} testID="edit-invoice-loading">
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
});
