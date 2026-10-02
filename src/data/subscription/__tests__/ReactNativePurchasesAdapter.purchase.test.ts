import { ReactNativePurchasesAdapter } from '../ReactNativePurchasesAdapter';

/**
 * Checks exactly what reaches the SDK's `purchasePackage` — the one place the
 * RevenueCat Test Store and Google Play differ for a plan change.
 */
const mockSdk = {
  LOG_LEVEL: { DEBUG: 'DEBUG' },
  STORE_REPLACEMENT_MODE: { WITH_TIME_PRORATION: 'WITH_TIME_PRORATION', DEFERRED: 'DEFERRED' },
  PURCHASES_ERROR_CODE: {},
  setLogLevel: jest.fn(async () => undefined),
  isConfigured: jest.fn(async () => false),
  configure: jest.fn(),
  getOfferings: jest.fn(async () => ({
    all: {
      metriqo_premium: {
        identifier: 'metriqo_premium',
        availablePackages: ['starter', 'business'].map((plan) => ({
          identifier: `${plan}_monthly`,
          product: { identifier: `metriqo_${plan}_monthly`, priceString: '$1.00', price: 1, currencyCode: 'USD' },
        })),
      },
    },
    current: null,
  })),
  purchasePackage: jest.fn(async () => ({
    customerInfo: { entitlements: { active: {}, all: {} }, activeSubscriptions: [], requestDate: '2026-10-02T00:00:00Z' },
  })),
};

jest.mock('react-native-purchases', () => ({ __esModule: true, default: mockSdk }), { virtual: true });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('ReactNativePurchasesAdapter.purchase', () => {
  it('Test Store: purchases without any product change info', async () => {
    const adapter = new ReactNativePurchasesAdapter({ apiKey: 'test_abc', store: 'test_store', issue: null }, 'android');

    await adapter.purchase('business_monthly');

    expect(mockSdk.purchasePackage).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'business_monthly' }),
      null,
      null,
    );
  });

  it('Test Store: refuses replacement parameters instead of sending them to the simulated store', async () => {
    const adapter = new ReactNativePurchasesAdapter({ apiKey: 'test_abc', store: 'test_store', issue: null }, 'android');

    await expect(
      adapter.purchase('business_monthly', { oldProductIdentifier: 'metriqo_starter_monthly', timing: 'immediate' }),
    ).rejects.toMatchObject({ kind: 'configuration' });
    expect(mockSdk.purchasePackage).not.toHaveBeenCalled();
  });

  it('Google Play: sends the owned product as oldProductIdentifier with the matching replacement mode', async () => {
    const adapter = new ReactNativePurchasesAdapter({ apiKey: 'goog_abc', store: 'google_play', issue: null }, 'android');

    await adapter.purchase('business_monthly', { oldProductIdentifier: 'metriqo_starter_monthly', timing: 'immediate' });
    await adapter.purchase('starter_monthly', { oldProductIdentifier: 'metriqo_business_monthly', timing: 'deferred' });

    expect(mockSdk.purchasePackage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ identifier: 'business_monthly' }),
      null,
      { oldProductIdentifier: 'metriqo_starter_monthly', replacementMode: 'WITH_TIME_PRORATION' },
    );
    expect(mockSdk.purchasePackage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ identifier: 'starter_monthly' }),
      null,
      { oldProductIdentifier: 'metriqo_business_monthly', replacementMode: 'DEFERRED' },
    );
  });

  it('Google Play: refuses to replace a product with itself', async () => {
    const adapter = new ReactNativePurchasesAdapter({ apiKey: 'goog_abc', store: 'google_play', issue: null }, 'android');

    await expect(
      adapter.purchase('business_monthly', { oldProductIdentifier: 'metriqo_business_monthly', timing: 'immediate' }),
    ).rejects.toMatchObject({ kind: 'configuration' });
    expect(mockSdk.purchasePackage).not.toHaveBeenCalled();
  });
});
