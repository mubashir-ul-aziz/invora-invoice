import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { CardPreview } from '@/components/businessCard/CardPreview';
import { socialLinkValue } from '@/domain/businessCard/types';
import { openFacebook, openInstagram, openWhatsApp } from '@/lib/linking';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessCardStore } from '@/state/businessCardStore';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'DigitalCard'>;

export function DigitalCardScreen({ navigation }: Props) {
  const { status, card, error, load } = useBusinessCardStore();
  // Also preloaded here (not just from the Business screen) so the merged
  // "Business profile" form — reachable from this screen without ever
  // visiting Business — has the invoice prefix/numbering ready as soon as it
  // mounts, instead of loading them itself (see `EditBusinessScreen`'s doc
  // comment for why it doesn't self-load).
  const { load: loadProfile } = useBusinessProfileStore();

  useEffect(() => {
    load();
    loadProfile();
  }, [load, loadProfile]);

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.centered} testID="digital-card-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered} testID="digital-card-error">
        <Text style={styles.errorText}>Couldn't load your business card.</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <ActionButton label="Try again" onPress={load} />
      </View>
    );
  }

  const whatsapp = socialLinkValue(card, 'whatsapp');
  const facebook = socialLinkValue(card, 'facebook');
  const instagram = socialLinkValue(card, 'instagram');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="digital-card-screen"
    >
      <CardPreview card={card} />

      {!card && (
        <Text style={styles.emptyState} testID="digital-card-empty">
          You haven't set up your business card yet.
        </Text>
      )}

      <View style={styles.row}>
        <ActionButton
          label="Edit card"
          variant="primary"
          onPress={() => navigation.navigate('EditBusinessCard')}
          testID="action-edit"
        />
        <ActionButton
          label="Share"
          onPress={() => navigation.navigate('ShareCard')}
          disabled={!card}
          testID="action-share"
        />
        <ActionButton
          label="Business"
          onPress={() => navigation.navigate('Business')}
          testID="action-business"
        />
      </View>

      {!!card && (whatsapp || facebook || instagram) && (
        <View style={styles.row}>
          {!!whatsapp && (
            <ActionButton
              label="WhatsApp"
              onPress={() => openWhatsApp(whatsapp)}
              testID="action-whatsapp"
            />
          )}
          {!!facebook && (
            <ActionButton
              label="Facebook"
              onPress={() => openFacebook(facebook)}
              testID="action-facebook"
            />
          )}
          {!!instagram && (
            <ActionButton
              label="Instagram"
              onPress={() => openInstagram(instagram)}
              testID="action-instagram"
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  emptyState: { color: colors.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
