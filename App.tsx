import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AutoBackupRunner } from '@/components/backup/AutoBackupRunner';
import { PlanVerificationGate } from '@/components/subscription/PlanVerificationGate';
import { SubscriptionRunner } from '@/components/subscription/SubscriptionRunner';
import { AppLockGate } from '@/components/security/AppLockGate';
import { ToastHost } from '@/components/shared/ToastHost';
import { getDatabase } from '@/data/db/client';
import { RootNavigator } from '@/navigation/RootNavigator';
import { CurrencyProvider } from '@/state/currencyContext';
import { colors } from '@/theme/colors';

export default function App() {
  const [dbState, setDbState] = useState<'loading' | 'ready' | 'error'>('loading');
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getDatabase()
      .then(() => setDbState('ready'))
      .catch(() => setDbState('error'));
  }, []);

  // Fade the first real screen in instead of popping it over the splash.
  useEffect(() => {
    if (dbState === 'loading') return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 700,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [dbState, opacity]);

  // The database usually opens in a few frames, so a plain background avoids a spinner flash.
  if (dbState === 'loading') {
    return <View style={styles.centered} />;
  }

  if (dbState === 'error') {
    return (
      <Animated.View style={[styles.centered, { opacity }]}>
        <Text style={styles.errorText}>Couldn't open the local database.</Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.root, { opacity }]}>
        <SafeAreaProvider>
          <NavigationContainer>
            <AppLockGate>
              <AutoBackupRunner>
                <SubscriptionRunner>
                  <PlanVerificationGate>
                    <CurrencyProvider>
                      <RootNavigator />
                    </CurrencyProvider>
                  </PlanVerificationGate>
                </SubscriptionRunner>
              </AutoBackupRunner>
              {/* After the navigator so it draws above every screen; inside the lock gate so nothing shows over the lock screen. */}
              <ToastHost />
            </AppLockGate>
          </NavigationContainer>
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: { color: colors.danger, textAlign: 'center', paddingHorizontal: 24 },
});
