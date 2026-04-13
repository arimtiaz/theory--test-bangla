jest.mock('react-native-webview', () => ({
  WebView: require('react').forwardRef((props, ref) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      ref,
      testID: 'mock-webview',
    }),
  ),
}));

jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock(
  'react-native-iap',
  () => {
    const fetchProducts = jest.fn(() => Promise.resolve());
    const finishTransaction = jest.fn(() => Promise.resolve());
    const requestPurchase = jest.fn(() => Promise.resolve());
    const getAvailablePurchases = jest.fn(() => Promise.resolve([]));
    const reconnect = jest.fn(() => Promise.resolve(true));

    return {
      __esModule: true,
      ErrorCode: {
        UserCancelled: 'user-cancelled',
        AlreadyOwned: 'already-owned',
        DeferredPayment: 'deferred-payment',
        BillingUnavailable: 'billing-unavailable',
        IapNotAvailable: 'iap-not-available',
        ServiceDisconnected: 'service-disconnected',
        FeatureNotSupported: 'feature-not-supported',
        NetworkError: 'network-error',
        RemoteError: 'remote-error',
        ItemUnavailable: 'item-unavailable',
        DeveloperError: 'developer-error',
      },
      getAvailablePurchases,
      useIAP: jest.fn(() => ({
        connected: true,
        products: [
          {
            id: 'theorytestbanglapremium',
            title: 'Theory Test Bangla Premium',
            displayPrice: '£6.99',
          },
        ],
        fetchProducts,
        finishTransaction,
        requestPurchase,
        reconnect,
      })),
    };
  },
  { virtual: true },
);
