import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { CardPreview } from '@/components/businessCard/CardPreview';
import { formatBackupTimestamp } from '@/domain/backup/formatting';
import { socialLinkValue } from '@/domain/businessCard/types';
import { openFacebook, openGoogleMaps, openInstagram, openWhatsApp } from '@/lib/linking';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessCardStore } from '@/state/businessCardStore';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'DigitalCard'>;

/**
 * Restyled to match the Stitch "Digital Card" design's header + action-bar
 * chrome around the existing `CardPreview` flip-card (shared with
 * `ShareCardScreen` — left alone here so both stay in sync). Adds a real
 * "Maps" quick action (`openGoogleMaps`, using the card's real address or
 * its `googleMaps` social link) alongside the existing WhatsApp/Facebook/
 * Instagram ones, and a real "Last updated" line from `card.updatedAt`.
 *
 * Stitch's "1,420 views" and "82 clients saved this contact" stats have no
 * backing data anywhere in this app (no analytics/tracking exists) and are
 * dropped entirely rather than shown, per this app's "never invent data"
 * rule — same treatment as every other fabricated stat this session.
 * Likewise its "Architectural Design & Contracting • London, UK" tagline
 * has no corresponding field on `BusinessCard` and is dropped.
 *
 * Deliberately NOT added: direct Call/Email/Website quick-action buttons.
 * `DigitalCardScreen.test.tsx` asserts `action-call`/`action-email`/
 * `action-website` stay absent even when `card.phone` is set — those
 * contact details are shown (non-interactively) on the card face itself
 * via `CardPreview`, and this screen intentionally only offers quick
 * actions for the social platforms, not a duplicate interactive copy of
 * the same contact fields.
 */
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
  const googleMaps = socialLinkValue(card, 'googleMaps');
  const hasMapsTarget = !!googleMaps || !!card?.address;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="digital-card-screen"
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Digital Business Card</Text>
      </View>

      <CardPreview card={card} />

      {!card && (
        <Text style={styles.emptyState} testID="digital-card-empty">
          You haven't set up your business card yet.
        </Text>
      )}

      {!!card && (
        <View style={styles.metaRow}>
          <Feather name="clock" size={12} color={colors.textMuted} />
          <Text style={styles.metaText}>Last updated {formatBackupTimestamp(card.updatedAt)}</Text>
        </View>
      )}

      <View style={styles.row}>
        <ActionButton
          label="Edit card"
          icon="edit-2"
          variant="primary"
          onPress={() => navigation.navigate('EditBusinessCard')}
          testID="action-edit"
        />
        <ActionButton
          label="Share"
          icon="share-2"
          onPress={() => navigation.navigate('ShareCard')}
          disabled={!card}
          testID="action-share"
        />
        <ActionButton
          label="Business"
          icon="briefcase"
          onPress={() => navigation.navigate('Business')}
          testID="action-business"
        />
      </View>

      {!!card && (whatsapp || facebook || instagram || hasMapsTarget) && (
        <>
          <Text style={styles.sectionHeader}>Connect with us</Text>
          <View style={styles.row}>
            {!!whatsapp && (
              <ActionButton
                label="WhatsApp"
                icon="message-circle"
                onPress={() => openWhatsApp(whatsapp)}
                testID="action-whatsapp"
              />
            )}
            {!!facebook && (
              <ActionButton
                label="Facebook"
                icon="facebook"
                onPress={() => openFacebook(facebook)}
                testID="action-facebook"
              />
            )}
            {!!instagram && (
              <ActionButton
                label="Instagram"
                icon="instagram"
                onPress={() => openInstagram(instagram)}
                testID="action-instagram"
              />
            )}
            {hasMapsTarget && (
              <ActionButton
                label="Maps"
                icon="map-pin"
                onPress={() => openGoogleMaps({ mapsUrl: googleMaps, address: card.address })}
                testID="action-maps"
              />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  emptyState: { color: colors.textMuted, textAlign: 'center' },
  headerRow: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  metaText: { fontSize: 11, color: colors.textMuted },
  sectionHeader: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginTop: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
