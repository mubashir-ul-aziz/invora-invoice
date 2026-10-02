import appJson from '../../../../app.json';
import easJson from '../../../../eas.json';

import { classifyApiKey, maskApiKey, resolveRevenueCatConfig } from '../revenueCatConfig';
import { expectedProductIds, matchOfferingPackages } from '../ReactNativePurchasesAdapter';

const TEST_KEY = 'test_AbCdEfGhIjKlMnOpQrStUvW';
const GOOGLE_KEY = 'goog_ZyXwVuTsRqPoNmLkJiHgFeD';

describe('resolveRevenueCatConfig', () => {
  it('R. a development build uses the Test Store key', () => {
    expect(resolveRevenueCatConfig({ isDev: true, platform: 'android', testStoreKey: TEST_KEY, googlePlayKey: GOOGLE_KEY })).toEqual({
      apiKey: TEST_KEY,
      store: 'test_store',
      issue: null,
    });
  });

  it('a development build without a Test Store key falls back to the Google Play key', () => {
    expect(resolveRevenueCatConfig({ isDev: true, platform: 'android', googlePlayKey: GOOGLE_KEY })).toMatchObject({
      apiKey: GOOGLE_KEY,
      store: 'google_play',
    });
  });

  it('S. a release build never uses a test_ key — Google Play key only', () => {
    expect(resolveRevenueCatConfig({ isDev: false, platform: 'android', testStoreKey: TEST_KEY, googlePlayKey: GOOGLE_KEY })).toMatchObject({
      apiKey: GOOGLE_KEY,
      store: 'google_play',
    });
  });

  it('S. a release build with only a test_ key disables RevenueCat (instead of the SDK crashing) and says why', () => {
    const config = resolveRevenueCatConfig({ isDev: false, platform: 'android', testStoreKey: TEST_KEY });
    expect(config.apiKey).toBeNull();
    expect(config.issue).toMatch(/release build/);
    // Even a test_ key placed in the Google variable is refused in release.
    expect(resolveRevenueCatConfig({ isDev: false, platform: 'android', googlePlayKey: TEST_KEY }).apiKey).toBeNull();
  });

  it('refuses secret keys everywhere', () => {
    expect(resolveRevenueCatConfig({ isDev: true, platform: 'android', testStoreKey: 'sk_secret123456' }).apiKey).toBeNull();
    expect(resolveRevenueCatConfig({ isDev: false, platform: 'android', googlePlayKey: 'sk_secret123456' }).apiKey).toBeNull();
  });

  it('explains a missing key (the cause of "not available in this build")', () => {
    const config = resolveRevenueCatConfig({ isDev: true, platform: 'android', testStoreKey: undefined, googlePlayKey: '' });
    expect(config.apiKey).toBeNull();
    expect(config.issue).toMatch(/EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY/);
  });

  it('is unavailable on web', () => {
    expect(resolveRevenueCatConfig({ isDev: true, platform: 'web', testStoreKey: TEST_KEY }).apiKey).toBeNull();
  });

  it('never puts a full key into an issue message', () => {
    for (const input of [
      { isDev: false, platform: 'android', testStoreKey: TEST_KEY },
      { isDev: false, platform: 'android', googlePlayKey: 'weird_key_value_1234' },
      { isDev: true, platform: 'android', testStoreKey: 'sk_secret123456' },
    ]) {
      const { issue } = resolveRevenueCatConfig(input);
      expect(issue).not.toContain(TEST_KEY);
      expect(issue).not.toContain('weird_key_value_1234');
      expect(issue).not.toContain('sk_secret123456');
    }
  });
});

describe('classifyApiKey / maskApiKey', () => {
  it('classifies keys by prefix', () => {
    expect(classifyApiKey(TEST_KEY)).toBe('test_store');
    expect(classifyApiKey(GOOGLE_KEY)).toBe('google_play');
    expect(classifyApiKey('sk_x')).toBe('secret');
    expect(classifyApiKey(' ')).toBe('empty');
  });

  it('masks all but a few characters', () => {
    expect(maskApiKey(TEST_KEY)).toBe('test_Ab…UvW');
    expect(maskApiKey(TEST_KEY)).not.toContain('CdEfGh');
    expect(maskApiKey('')).toBe('(not set)');
  });
});

describe('S. build configuration', () => {
  it('release profiles (preview, production) carry no test_ key', () => {
    for (const profile of ['preview', 'production']) {
      expect(JSON.stringify(easJson.build[profile as keyof typeof easJson.build] ?? {})).not.toMatch(/test_/);
    }
  });

  it('the development profile is a development client (debug build — Test Store allowed)', () => {
    expect(easJson.build.development.developmentClient).toBe(true);
  });

  it('keeps the Android package com.metriqo.invoice', () => {
    expect(appJson.expo.android.package).toBe('com.metriqo.invoice');
  });

  it('no RevenueCat key is hard-coded in app.json', () => {
    expect(JSON.stringify(appJson)).not.toMatch(/(test|goog|sk)_[A-Za-z0-9]{10,}/);
  });
});

describe('Offering package matching', () => {
  const pkg = (identifier: string, productId: string) => ({ identifier, product: { identifier: productId } }) as never;

  it('expects exactly the eight metriqo_<plan>_<period> products', () => {
    expect(expectedProductIds().sort()).toEqual(
      [
        'metriqo_business_monthly',
        'metriqo_business_yearly',
        'metriqo_pro_monthly',
        'metriqo_pro_yearly',
        'metriqo_starter_monthly',
        'metriqo_starter_yearly',
        'metriqo_unlimited_monthly',
        'metriqo_unlimited_yearly',
      ].sort(),
    );
  });

  it('matches by product id even when the dashboard package ids differ, and by package id as a fallback', () => {
    const matched = matchOfferingPackages({
      availablePackages: [
        pkg('$rc_monthly', 'metriqo_starter_monthly'),
        pkg('custom_yearly', 'metriqo_starter_yearly:yearly'),
        pkg('pro_monthly', 'something_else'),
        pkg('random', 'unrelated_product'),
      ],
    });
    expect([...matched.keys()].sort()).toEqual(['pro_monthly', 'starter_monthly', 'starter_yearly']);
    expect(matched.get('starter_yearly')).toMatchObject({ plan: 'starter', period: 'yearly' });
  });
});
