# React Native IAP Setup

## 1. Install the SDK with npm

```sh
npm install react-native-iap@14.7.19
```

For iOS, install pods after the npm install completes:

```sh
cd ios
bundle exec pod install
```

## 2. Store configuration

App Store Connect:

- Create a non-consumable product with ID `theorytestbanglapremium` priced at £9.99 GBP.
- Ensure the iOS target has the In-App Purchase capability enabled.
- Use a Sandbox tester on a physical device for the most reliable testing.
- Simulator testing still requires launching from Xcode with the StoreKit configuration attached to the active scheme.

Google Play Console:

- Create a one-time product with ID `theorytestbanglapremium` priced at £9.99 GBP.
- Upload the app to an internal, closed, or open test track before testing purchases.
- Add your test Google account under Settings → License testing.

## 3. App integration points

Store product configuration is stored in [src/services/IAPConfig.ts](../src/services/IAPConfig.ts).

The lifetime SKU helpers live in [src/services/IAPService.ts](../src/services/IAPService.ts).

The purchase flow is implemented directly in [App.tsx](../App.tsx) with `useIAP`:

- Connects to the store automatically through `useIAP`
- Fetches the `theorytestbanglapremium` product as an `in-app` purchase
- Starts purchases with `requestPurchase`
- Restores ownership with `getAvailablePurchases`
- Calls the backend premium-upgrade API after store success
- Finishes non-consumable transactions after backend sync succeeds

## 4. Validation checklist

- Confirm the user signs in before attempting purchase.
- Verify the store returns `theorytestbanglapremium` on both platforms.
- Confirm the backend user is upgraded after a successful purchase or restore.
- Confirm `finishTransaction({ isConsumable: false })` runs after premium sync succeeds.
- Test restore flows on both iOS and Android test accounts.