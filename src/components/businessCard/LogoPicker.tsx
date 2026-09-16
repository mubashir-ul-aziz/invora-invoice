import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface Props {
  logoUri: string | null;
  onChange: (uri: string | null) => void;
}

/** Picks an image from the device library — works fully offline. Restyled to match the Stitch "camera badge" logo tile, same real `expo-image-picker` flow underneath. */
export function LogoPicker({ logoUri, onChange }: Props) {
  const pickLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo library access to set a business logo.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      onChange(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={pickLogo}
        accessibilityRole="button"
        accessibilityLabel="Choose business logo"
        testID="logo-picker"
        style={styles.tap}
      >
        {logoUri ? (
          <Image source={{ uri: logoUri }} style={styles.logo} testID="logo-preview" />
        ) : (
          <View style={styles.placeholder} testID="logo-placeholder">
            <Feather name="image" size={26} color={colors.textMuted} />
            <Text style={styles.placeholderText}>Add logo</Text>
          </View>
        )}
        <View style={styles.cameraBadge}>
          <Feather name="camera" size={14} color={colors.primaryText} />
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={pickLogo}>
        <Text style={styles.uploadLink}>Upload new logo</Text>
      </Pressable>
      <Text style={styles.caption}>PNG or JPG</Text>
      {!!logoUri && (
        <Pressable onPress={() => onChange(null)} accessibilityRole="button" testID="logo-remove">
          <Text style={styles.remove}>Remove logo</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 4 },
  tap: { alignItems: 'center' },
  logo: { width: 88, height: 88, borderRadius: 16 },
  placeholder: {
    width: 88,
    height: 88,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  placeholderText: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  cameraBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadLink: { color: colors.primary, fontSize: 14, fontWeight: '700', marginTop: 8 },
  caption: { fontSize: 11, color: colors.textMuted },
  remove: { color: colors.danger, fontSize: 13, marginTop: 4 },
});
