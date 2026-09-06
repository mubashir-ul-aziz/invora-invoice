import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { CardPreview } from '@/components/businessCard/CardPreview';
import { buildShareMessage } from '@/domain/businessCard/shareText';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessCardStore } from '@/state/businessCardStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ShareCard'>;

/** Uses the native share sheet — works with or without internet; no backend involved. */
export function ShareCardScreen({}: Props) {
  const { card, getShareLink } = useBusinessCardStore();
  const shareLink = getShareLink();

  const onShare = async () => {
    if (!card || !shareLink) return;
    try {
      await Share.share({
        message: buildShareMessage(card, shareLink),
        title: card.businessName,
      });
    } catch {
      // The user cancelling the share sheet also lands here on some platforms — no-op.
    }
  };

  if (!card || !shareLink) {
    return (
      <View style={styles.centered} testID="share-empty">
        <Text style={styles.emptyText}>Set up your business card first to share it.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="share-card-screen">
      <CardPreview card={card} />
      <Text style={styles.link} testID="share-link-text">
        {shareLink}
      </Text>
      <ActionButton label="Share business card" variant="primary" onPress={onShare} testID="share-button" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  link: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
