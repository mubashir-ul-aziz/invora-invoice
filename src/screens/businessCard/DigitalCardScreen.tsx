import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { CardPreview } from '@/components/businessCard/CardPreview';
import { socialLinkValue } from '@/domain/businessCard/types';
import {
  openEmail,
  openFacebook,
  openGoogleMaps,
  openInstagram,
  openPhone,
  openWebsite,
  openWhatsApp,
} from '@/lib/linking';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessCardStore } from '@/state/businessCardStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'DigitalCard'>;

export function DigitalCardScreen({ navigation }: Props) {
  const { status, card, error, load } = useBusinessCardStore();

  useEffect(() => {
    load();
  }, [load]);

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
  const googleMapsUrl = socialLinkValue(card, 'googleMaps');

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
          label="QR code"
          onPress={() => navigation.navigate('QRCode')}
          disabled={!card}
          testID="action-qr"
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

      {!!card && (
        <View style={styles.row}>
          {!!card.phone && (
            <ActionButton label="Call" onPress={() => openPhone(card.phone!)} testID="action-call" />
          )}
          {!!card.email && (
            <ActionButton label="Email" onPress={() => openEmail(card.email!)} testID="action-email" />
          )}
          {!!card.website && (
            <ActionButton
              label="Website"
              onPress={() => openWebsite(card.website!)}
              testID="action-website"
            />
          )}
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
          {(!!card.address || !!googleMapsUrl) && (
            <ActionButton
              label="Directions"
              onPress={() => openGoogleMaps({ address: card.address, mapsUrl: googleMapsUrl })}
              testID="action-maps"
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
