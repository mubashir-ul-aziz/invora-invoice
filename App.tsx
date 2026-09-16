import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AutoBackupRunner } from '@/components/backup/AutoBackupRunner';
import { AppLockGate } from '@/components/security/AppLockGate';
import { getDatabase } from '@/data/db/client';
import { RootNavigator } from '@/navigation/RootNavigator';
import { CurrencyProvider } from '@/state/currencyContext';
import { colors } from '@/theme/colors';

export default function App() {
  const [dbState, setDbState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    getDatabase()
      .then(() => setDbState('ready'))
      .catch(() => setDbState('error'));
  }, []);

  if (dbState !== 'ready') {
    return (
      <View style={styles.centered}>
        {dbState === 'loading' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.errorText}>Couldn't open the local database.</Text>
        )}
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppLockGate>
          <AutoBackupRunner>
            <CurrencyProvider>
              <RootNavigator />
            </CurrencyProvider>
          </AutoBackupRunner>
        </AppLockGate>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: { color: colors.danger, textAlign: 'center', paddingHorizontal: 24 },
});
