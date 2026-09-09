import React, { useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { buildBusinessCardVCard } from '@/domain/businessCard/qrPayload';
import { socialLinkValue, type BusinessCard } from '@/domain/businessCard/types';
import { colors } from '@/theme/colors';

interface Props {
  card: BusinessCard | null;
}

const CARD_HEIGHT = 230;

const SOCIAL_LABELS: Record<'whatsapp' | 'facebook' | 'instagram' | 'googleMaps', string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  googleMaps: 'Maps',
};

/**
 * The visual card — reused by the Digital Card screen and the Share screen
 * preview. Modeled on a real, physical business card: front shows the
 * business identity/contact details, back shows social links plus a small
 * QR code. Tapping flips between the two sides (front <-> back), same
 * gesture a printed card's "turn it over" affordance stands in for.
 */
export function CardPreview({ card }: Props) {
  const [flipped, setFlipped] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  const flip = () => {
    Animated.spring(spin, {
      toValue: flipped ? 0 : 1,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setFlipped((prev) => !prev);
  };

  const frontRotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  const businessName = card?.businessName?.trim() || 'Your business name';
  const hasLogo = !!card?.logoUri;

  const whatsapp = socialLinkValue(card, 'whatsapp');
  const facebook = socialLinkValue(card, 'facebook');
  const instagram = socialLinkValue(card, 'instagram');
  const googleMaps = socialLinkValue(card, 'googleMaps');
  const socialEntries = (
    [
      ['whatsapp', whatsapp],
      ['facebook', facebook],
      ['instagram', instagram],
      ['googleMaps', googleMaps],
    ] as const
  ).filter((entry): entry is [keyof typeof SOCIAL_LABELS, string] => !!entry[1]);

  return (
    <View>
      <Pressable
        onPress={flip}
        testID="card-preview"
        accessibilityRole="button"
        accessibilityLabel={flipped ? 'Show card front' : 'Show card back'}
        style={styles.flipContainer}
      >
        <Animated.View
          style={[styles.card, styles.face, { transform: [{ rotateY: frontRotateY }] }]}
          testID="card-preview-front"
        >
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
            {card?.taxId && <DetailRow label="Tax / VAT" value={card.taxId} />}
            {!card?.phone && !card?.email && !card?.website && !card?.address && (
              <Text style={styles.emptyHint}>Add contact details to complete this card.</Text>
            )}
          </View>
        </Animated.View>

        <Animated.View
          style={[styles.card, styles.face, styles.back, { transform: [{ rotateY: backRotateY }] }]}
          testID="card-preview-back"
        >
          <View style={styles.backTop}>
            <Text style={styles.businessName} numberOfLines={1}>
              {businessName}
            </Text>
            <View style={styles.details}>
              {socialEntries.map(([platform, value]) => (
                <DetailRow key={platform} label={SOCIAL_LABELS[platform]} value={value} />
              ))}
              {socialEntries.length === 0 && (
                <Text style={styles.emptyHint}>Add social links to complete this side.</Text>
              )}
            </View>
          </View>

          {!!card && (
            <View style={styles.qrWrapper} testID="card-preview-qr">
              <QRCode value={buildBusinessCardVCard(card)} size={64} backgroundColor={colors.surface} />
            </View>
          )}
        </Animated.View>
      </Pressable>
      <Text style={styles.flipHint}>Tap the card to flip it over</Text>
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
  flipContainer: {
    height: CARD_HEIGHT,
  },
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
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backTop: { flex: 1, gap: 12 },
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
  qrWrapper: {
    padding: 6,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flipHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
});
