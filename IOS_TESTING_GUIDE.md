# 🍏 iOS IAP Testing Guide for Junior Developers

Hi! This guide will help you test the new In-App Purchase (IAP) and Restore flows on iOS. We are using `react-native-iap` with a local **StoreKit Configuration** for testing.

---

### Step 1: Prepare the Environment
Before opening Xcode, ensure you have the latest dependencies:

1.  **Pull the latest code**: `git pull origin main`
2.  **Install Pods**:
    ```bash
    cd ios && pod install && cd ..
    ```

---

### Step 2: Configure Xcode for Local Testing
We use a `.storekit` file so you don't need to connect to the "real" App Store during development.

1.  Open `TheoryTestBangla.xcworkspace` in Xcode.
2.  In the top toolbar, click on the **Scheme** (next to the Play/Stop buttons) and select **Edit Scheme...**.
3.  Select **Run** on the left sidebar.
4.  Click the **Options** tab at the top.
5.  Find the **StoreKit Configuration** dropdown and select **Products.storekit**.
6.  Click **Close**.

> [!IMPORTANT]
> If you don't select the StoreKit file, `fetchProducts` will return an empty array in the simulator.

---

### Step 3: Test the Purchase Flow
1.  Run the app on an iOS Simulator (iPhone 15 or later recommended).
2.  Navigate to a page that triggers the "Upgrade Now" button (e.g., `/profile` or `/membership`).
3.  Tap **Upgrade Now**.
4.  A native Apple "Confirm Purchase" sheet should appear.
5.  Confirm the purchase using the simulator's default test account (no real money is used).
6.  **Verify**: The app should show a "You are now a Premium member!" toast and automatically reload the WebView to show your premium status.

---

### Step 4: Test the Restore Flow
The "Restore Purchases" button is now always visible on mobile for testing.

1.  Delete the app from the simulator and reinstall it (to clear the app's internal state).
2.  Login to a "Free" account.
3.  Tap the **Restore Purchases** button.
4.  The app should search the StoreKit file, find your previous purchase, and automatically sync it with the backend.
5.  **Verify**: Your account should be upgraded to Premium without you having to pay again.

---

### Step 5: How to Debug (The "Call Chain")
If something goes wrong, I've added a consistent logging system. Open your terminal and run:

```bash
npx react-native log-ios | grep "\[IAP-FLOW\]"
```

**What to look for in the logs:**
- `[IAP-FLOW] Initiation`: The app is starting a purchase request.
- `[IAP-FLOW] Success`: The App Store successfully processed the payment.
- `[IAP-FLOW] Sync`: The app is sending the purchase data to our backend (`UserService`).
- `[IAP-FLOW] [UserService] Sync SUCCESSFUL`: Our backend has confirmed the user is now Premium.

---

### ⚠️ Common Issues
- **Empty Products**: If you see "Premium is temporarily unavailable," make sure you completed **Step 2** (selecting the StoreKit file).
- **Backend Rejection**: If the log says "Sync FAILED," check the `UserService` logs to see the status code from the server.
