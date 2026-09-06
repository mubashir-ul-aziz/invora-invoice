import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface Props {
  logoUri: string | null;
  onChange: (uri: string | null) => void;
}

/** Picks an image from the device library — works fully offline. */
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
            <Text style={styles.placeholderText}>Add logo</Text>
          </View>
        )}
      </Pressable>
      {logoUri && (
        <Pressable onPress={() => onChange(null)} accessibilityRole="button" testID="logo-remove">
          <Text style={styles.remove}>Remove logo</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  tap: { alignItems: 'center' },
  logo: { width: 88, height: 88, borderRadius: 16 },
  placeholder: {
    width: 88,
    height: 88,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  remove: { color: colors.danger, fontSize: 13 },
});
