/**
 * Which RevenueCat public SDK key this build uses, decided in one place.
 *
 *  - Development (`__DEV__`, i.e. a development-client build running a Metro
 *    bundle): the **Test Store** key (`test_…`) from
 *    `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY`. Falls back to the Google
 *    Play key when no Test Store key is set.
 *  - Release (preview/production builds): ONLY the **Google Play** key
 *    (`goog_…`) from `EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY`. A `test_` key is
 *    refused here — RevenueCat's SDK deliberately shows an alert and crashes a
 *    release build configured with a Test Store key, so refusing it keeps the
 *    app running (on Free/cached state) and reports why instead.
 *  - A secret key (`sk_…`) is refused everywhere: it must never ship in an app.
 *
 * Pure: the caller passes `isDev`, the platform and the raw env values, so
 * every rule is unit-testable.
 */

export type RevenueCatStoreKind = 'test_store' | 'google_play';

export interface RevenueCatConfig {
  /** The key to configure the SDK with; null = RevenueCat is not available in this build. */
  apiKey: string | null;
  store: RevenueCatStoreKind | null;
  /** Developer-facing reason RevenueCat is unavailable (or a key was ignored). Never contains a full key. */
  issue: string | null;
}

export interface RevenueCatConfigInput {
  isDev: boolean;
  platform: string;
  testStoreKey?: string | null;
  googlePlayKey?: string | null;
}

export type ApiKeyKind = 'test_store' | 'google_play' | 'app_store' | 'secret' | 'unknown' | 'empty';

export function classifyApiKey(raw: string | null | undefined): ApiKeyKind {
  const key = (raw ?? '').trim();
  if (!key) return 'empty';
  if (/^sk_/i.test(key)) return 'secret';
  if (key.startsWith('test_')) return 'test_store';
  if (key.startsWith('goog_')) return 'google_play';
  if (key.startsWith('appl_')) return 'app_store';
  return 'unknown';
}

/** `test_RzMA…mpqXP` → `test_Rz…qXP` — enough to recognise a key in logs/reports, never the whole thing. */
export function maskApiKey(raw: string | null | undefined): string {
  const key = (raw ?? '').trim();
  if (!key) return '(not set)';
  const underscore = key.indexOf('_');
  const prefix = underscore >= 0 ? key.slice(0, underscore + 1) : '';
  const body = key.slice(prefix.length);
  if (body.length <= 6) return `${prefix}***`;
  return `${prefix}${body.slice(0, 2)}…${body.slice(-3)}`;
}

export function resolveRevenueCatConfig({ isDev, platform, testStoreKey, googlePlayKey }: RevenueCatConfigInput): RevenueCatConfig {
  const testKind = classifyApiKey(testStoreKey);
  const googleKind = classifyApiKey(googlePlayKey);

  if (platform !== 'android' && platform !== 'ios') {
    return { apiKey: null, store: null, issue: `RevenueCat is not supported on platform "${platform}".` };
  }
  if (testKind === 'secret' || googleKind === 'secret') {
    return {
      apiKey: null,
      store: null,
      issue: 'A RevenueCat SECRET key (sk_…) was provided. Only public SDK keys may ship in the app — subscriptions are disabled.',
    };
  }

  if (isDev && testKind === 'test_store') {
    return { apiKey: testStoreKey!.trim(), store: 'test_store', issue: null };
  }

  if (platform === 'android' && googleKind === 'google_play') {
    const ignoredTest = !isDev && testKind !== 'empty';
    return {
      apiKey: googlePlayKey!.trim(),
      store: 'google_play',
      issue: ignoredTest ? 'Test Store key ignored: Test Store keys are only used in development builds.' : null,
    };
  }

  // Nothing usable. Explain the most likely mistake.
  let issue: string;
  if (!isDev && (testKind === 'test_store' || googleKind === 'test_store')) {
    issue =
      'This is a release build and only a Test Store key (test_…) is configured. Test Store keys only work in ' +
      'development builds — set EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY (goog_…) for release builds.';
  } else if (googleKind !== 'empty' && googleKind !== 'google_play') {
    issue = 'EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY is not a Google Play public SDK key (expected goog_…).';
  } else if (testKind !== 'empty' && testKind !== 'test_store') {
    issue = 'EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY is not a Test Store key (expected test_…).';
  } else if (platform === 'ios') {
    issue = 'No RevenueCat key for iOS in this build.';
  } else {
    issue = isDev
      ? 'No RevenueCat key in this bundle. Set EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY in .env.local and restart `expo start --clear`.'
      : 'No RevenueCat key in this build. Set EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY (goog_…) for this EAS build profile.';
  }
  return { apiKey: null, store: null, issue };
}
