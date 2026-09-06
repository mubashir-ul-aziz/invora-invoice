import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import type { BusinessCard } from '@/domain/businessCard/types';

interface Props {
  card: BusinessCard | null;
}

/** The visual card itself — reused by the Digital Card screen and the Share screen preview. */
export function CardPreview({ card }: Props) {
  const businessName = card?.businessName?.trim() || 'Your business name';
  const hasLogo = !!card?.logoUri;

  return (
    <View style={styles.card} testID="card-preview">
      <View style={styles.header}>
        {hasLogo ? (
          <Image source={{ uri: card!.logoUri! }} style={styles.logo} testID="card-logo-image" />
        ) : (
          <View style={styles.logoPlaceholder} testID="card-logo-placeholder">
            <Text style={styles.logoPlaceholderText}>
              {businessName.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.businessName} numberOfLines={2}>
            {businessName}
          </Text>
          {!!card?.ownerName && <Text style={styles.ownerName}>{card.ownerName}</Text>}
        </View>
      </View>

      <View style={styles.details}>
        {card?.phone && <DetailRow label="Phone" value={card.phone} />}
        {card?.email && <DetailRow label="Email" value={card.email} />}
        {card?.website && <DetailRow label="Website" value={card.website} />}
        {card?.address && <DetailRow label="Address" value={card.address} />}
        {!card?.phone && !card?.email && !card?.website && !card?.address && (
          <Text style={styles.emptyHint}>Add contact details to complete this card.</Text>
        )}
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 14,
    backgroundColor: colors.border,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    color: colors.primaryText,
    fontSize: 24,
    fontWeight: '700',
  },
  headerText: { flex: 1 },
  businessName: { fontSize: 18, fontWeight: '700', color: colors.text },
  ownerName: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  details: { gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailLabel: { fontSize: 13, color: colors.textMuted },
  detailValue: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: 'right' },
  emptyHint: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
});
