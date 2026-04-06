import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  ActivityIndicator,
  View,
  StatusBar,
  Platform,
  Pressable,
  Text,
} from 'react-native';
import {
  ErrorCode,
  getAvailablePurchases as getAvailablePurchasesDirect,
  type Purchase,
  useIAP,
} from 'react-native-iap';
import { WebView } from 'react-native-webview';
import BootSplash from 'react-native-bootsplash';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import NoInternetScreen from './src/components/NoInternetScreen';
import SubscriptionDebugPanel from './src/components/SubscriptionDebugPanel';
import {
  IAP_LIFETIME_PRODUCT_ID,
  IAP_PRODUCT_IDS,
  IAP_PRODUCT_TYPE,
} from './src/services/IAPConfig';
import {
  classifyStoreError,
  findLifetimeProduct,
  findLifetimePurchase,
  getPurchaseErrorMessage,
  getStoreErrorMessage,
  getUnavailablePurchaseMessage,
  isRetryableStoreError,
  type StoreErrorReason,
} from './src/services/IAPService';
import {
  getRestoreCompletionToast,
  getRestorePrecheck,
  RestoreStatus,
  shouldShowRestoreAction,
  shouldShowSubscriptionDebugMenu,
} from './src/services/subscriptionDebug';
import { UserService } from './src/services/UserService';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#160478"
        translucent={false}
      />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const currentAccessTokenRef = useRef<string | null>(null);
  const pendingPurchaseAfterSessionSyncRef = useRef(false);
  const pendingPurchaseFinishRef = useRef<Purchase | null>(null);
  const pendingPremiumSyncRef = useRef<{
    userId: string;
    accessToken: string | null;
    source: 'purchase' | 'restore';
    attempts: number;
  } | null>(null);
  const sessionSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const premiumSyncRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sessionSnapshotResolverRef = useRef<((userId: string | null) => void) | null>(
    null,
  );
  const upgradeWatchdogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const premiumConfirmedRef = useRef(false);
  const lastAutoSyncedUserRef = useRef<string | null>(null);
  const productFetchRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productFetchAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [storeErrorReason, setStoreErrorReason] = useState<StoreErrorReason | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentAccessToken, setCurrentAccessToken] = useState<string | null>(null);
  const [currentUserSubscription, setCurrentUserSubscription] = useState<
    'free' | 'premium' | null
  >(null);
  const [currentUrl, setCurrentUrl] = useState('https://theorytestbangla.co.uk');
  const [webViewInstanceKey, setWebViewInstanceKey] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [showSubscriptionTools, setShowSubscriptionTools] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus>('idle');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const stopUpgradeWatchdog = useCallback(() => {
    if (upgradeWatchdogTimeoutRef.current) {
      clearTimeout(upgradeWatchdogTimeoutRef.current);
      upgradeWatchdogTimeoutRef.current = null;
    }
  }, []);

  const clearUpgradeState = useCallback(() => {
    stopUpgradeWatchdog();
    setIsUpgrading(false);
  }, [stopUpgradeWatchdog]);

  const beginUpgradeState = useCallback(() => {
    stopUpgradeWatchdog();
    setIsUpgrading(true);
    upgradeWatchdogTimeoutRef.current = setTimeout(() => {
      upgradeWatchdogTimeoutRef.current = null;
      setIsUpgrading(false);
      showToast(
        'Purchase processing is taking longer than expected. The app is still retrying in the background.',
        'info',
      );
    }, 20000);
  }, [stopUpgradeWatchdog]);

  const restartAppShell = useCallback((delayMs = 400) => {
    clearPendingPurchaseSessionSync();
    setShowSubscriptionTools(false);
    setCurrentUrl('https://theorytestbangla.co.uk');
    setTimeout(() => {
      setWebViewInstanceKey(value => value + 1);
    }, delayMs);
  }, []);

  const {
    connected: isStoreConnected,
    products,
    subscriptions = [],
    fetchProducts,
    finishTransaction,
    requestPurchase,
    reconnect,
  } = useIAP({
    onPurchaseSuccess: purchase => {
      void handleNativePurchaseSuccess(purchase);
    },
    onPurchaseError: error => {
      if (error.code === ErrorCode.UserCancelled) {
        showToast('Purchase cancelled', 'info');
      } else if (error.code === ErrorCode.AlreadyOwned) {
        showToast('You already own this item. Try restoring your purchase.', 'info');
      } else if (error.code === ErrorCode.DeferredPayment) {
        showToast('Your purchase is pending approval. It will be activated once confirmed.', 'info');
      } else {
        console.error('[IAP] Purchase failed:', error);
        showToast(getPurchaseErrorMessage(error), 'error');
      }

      clearUpgradeState();
    },
    onError: error => {
      console.error('[IAP] Store operation failed:', error);
      const reason = classifyStoreError(error as { code?: string; message?: string });
      setStoreErrorReason(reason);

      if (!isRetryableStoreError(reason)) {
        showToast(getStoreErrorMessage(reason), 'error');
      }
    },
  });
  const lifetimeProduct = findLifetimeProduct([...products, ...subscriptions]);

  const clearPendingPurchaseSessionSync = () => {
    pendingPurchaseAfterSessionSyncRef.current = false;

    if (sessionSyncTimeoutRef.current) {
      clearTimeout(sessionSyncTimeoutRef.current);
      sessionSyncTimeoutRef.current = null;
    }
  };

  const clearPendingPremiumSync = useCallback(() => {
    pendingPremiumSyncRef.current = null;

    if (premiumSyncRetryTimeoutRef.current) {
      clearTimeout(premiumSyncRetryTimeoutRef.current);
      premiumSyncRetryTimeoutRef.current = null;
    }
  }, []);

  async function finalizePendingPurchaseTransaction(
    targetPurchase?: Purchase,
  ): Promise<void> {
    const purchase = targetPurchase ?? pendingPurchaseFinishRef.current;

    if (!purchase) {
      return;
    }

    try {
      await finishTransaction({
        purchase,
        isConsumable: false,
      });
      pendingPurchaseFinishRef.current = null;
    } catch (error) {
      console.warn('[IAP] Could not finish transaction yet:', error);
    }
  }
  async function handleNativePurchaseSuccess(purchase: Purchase): Promise<void> {
    const purchasedIds = purchase.ids || [];
    if (purchase.productId && !purchasedIds.includes(purchase.productId)) {
        purchasedIds.push(purchase.productId);
    }
    console.log('[IAP-FLOW] Success: Store returned successful purchase!', {
      productId: purchase.productId,
      transactionId: purchase.transactionId,
      purchasedIds: purchasedIds,
      purchaseToken: purchase.purchaseToken ? '(present)' : '(missing)',
      transactionDate: purchase.transactionDate,
    });

    if (!purchasedIds.includes(IAP_LIFETIME_PRODUCT_ID)) {
      console.log(`[IAP-FLOW] Success: Ignored purchase SKU ${purchase.productId} - does not match target ${IAP_LIFETIME_PRODUCT_ID}`);
      pendingPurchaseFinishRef.current = purchase;
      await finalizePendingPurchaseTransaction(purchase);
      clearUpgradeState();
      return;
    }

    const effectiveUserId =
      currentUserIdRef.current ?? (await resolveUserIdFromWebView());
    
    console.log(`[IAP-FLOW] Success: Beginning sync for user ${effectiveUserId}`);

    if (!effectiveUserId) {
      pendingPurchaseFinishRef.current = purchase;
      clearUpgradeState();
      showToast(
        'Purchase completed, but your session could not be confirmed. Please sign in and tap Restore Purchases.',
        'info',
      );
      return;
    }

    pendingPurchaseFinishRef.current = purchase;

    if (currentUserSubscription === 'premium' || premiumConfirmedRef.current) {
      await finalizePendingPurchaseTransaction(purchase);
      clearUpgradeState();
      restartAppShell();
      return;
    }

    beginUpgradeState();

    try {
      await syncPremiumAccess(
        effectiveUserId,
        'purchase',
        currentAccessTokenRef.current,
      );
    } finally {
      clearUpgradeState();
    }
  }

  const requestSessionSnapshot = () => {
    webViewRef.current?.injectJavaScript(`
      (function() {
        try {
          var userId = localStorage.getItem('user_id');
          var at = localStorage.getItem('accessToken') || localStorage.getItem('authToken');
          var subscription = 'free';
          if (at && at.indexOf('.') > 0) {
            try {
              var parts = at.split('.');
              var b64 = parts[1].replace(/-/g,'+').replace(/_/g,'/');
              var pad = b64 + '=='.slice(0,(4-b64.length%4)%4);
              var json = decodeURIComponent(atob(pad).split('').map(function(c){return '%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)}).join(''));
              var payload = JSON.parse(json);
              if (!userId && payload && payload.sub) userId = payload.sub;
              subscription = payload?.user_metadata?.subscription || payload?.subscription || 'free';
            } catch(e){}
          }
          if (userId) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SESSION_DATA',
              userId: userId,
              accessToken: at || null,
              subscription: subscription
            }));
          }
        } catch(e) {}
        true;
      })();
    `);
  };

  const resolveUserIdFromWebView = useCallback(async (): Promise<string | null> => {
    if (currentUserIdRef.current) {
      return currentUserIdRef.current;
    }

    requestSessionSnapshot();

    return new Promise(resolve => {
      sessionSnapshotResolverRef.current = resolve;

      setTimeout(() => {
        if (sessionSnapshotResolverRef.current === resolve) {
          sessionSnapshotResolverRef.current = null;
          resolve(currentUserIdRef.current);
        }
      }, 3000);
    });
  }, []);

  const schedulePendingPremiumSyncRetry = useCallback((delayMs: number) => {
    if (premiumSyncRetryTimeoutRef.current) {
      clearTimeout(premiumSyncRetryTimeoutRef.current);
    }

    premiumSyncRetryTimeoutRef.current = setTimeout(() => {
      premiumSyncRetryTimeoutRef.current = null;
      flushPendingPremiumSync();
    }, delayMs);
  }, []);

  const syncPremiumAccess = useCallback(
    async (
      userId: string,
      source: 'purchase' | 'restore',
      accessToken?: string | null,
    ): Promise<boolean> => {
      try {
        const previousAttempts = pendingPremiumSyncRef.current?.attempts ?? 0;
        console.log(`[IAP-FLOW] Sync: Calling backend to upgrade ${userId} (Source: ${source}, Attempt: ${previousAttempts + 1})`);
        
        const result = await UserService.upgradeUserToPremium(
          userId,
          accessToken ?? currentAccessTokenRef.current,
        );

        if (!result.success) {
          console.warn(`[IAP-FLOW] Sync: Backend rejected upgrade (${result.statusCode ?? 'network error'}). Result message: ${result.message}`);
          if (result.retryable && previousAttempts + 1 < 5) {
            pendingPremiumSyncRef.current = {
              userId,
              accessToken: accessToken ?? currentAccessTokenRef.current,
              source,
              attempts: previousAttempts + 1,
            };

            schedulePendingPremiumSyncRetry(source === 'purchase' ? 4000 : 6000);
          } else {
            clearPendingPremiumSync();
          }

          if (source === 'purchase' && previousAttempts === 0) {
            showToast(
              result.retryable
                ? 'Purchase completed. Premium activation is retrying in the background.'
                : 'Purchase completed but premium activation failed. Please contact support.',
              'info',
            );
          }

          return false;
        }

        clearPendingPremiumSync();
        premiumConfirmedRef.current = true;
        lastAutoSyncedUserRef.current = userId;
        setCurrentUserSubscription('premium');

        if (pendingPurchaseFinishRef.current) {
          await finalizePendingPurchaseTransaction();
        }

        clearUpgradeState();

        if (source === 'purchase') {
          showToast('You are now a Premium member!', 'success');
        }

        restartAppShell(source === 'purchase' ? 1200 : 200);

        return true;
      } catch (error) {
        console.error('Premium activation error:', error);

        const previousAttempts = pendingPremiumSyncRef.current?.attempts ?? 0;

        if (previousAttempts + 1 < 5) {
          pendingPremiumSyncRef.current = {
            userId,
            accessToken: accessToken ?? currentAccessTokenRef.current,
            source,
            attempts: previousAttempts + 1,
          };
          schedulePendingPremiumSyncRetry(source === 'purchase' ? 4000 : 6000);
        } else {
          clearPendingPremiumSync();
        }

        if (source === 'purchase' && previousAttempts === 0) {
          showToast('Purchase completed. Premium activation is retrying in the background.', 'info');
        }

        return false;
      }
    },
    [
      clearPendingPremiumSync,
      clearUpgradeState,
      restartAppShell,
      schedulePendingPremiumSyncRetry,
    ],
  );

  const flushPendingPremiumSync = useCallback(async () => {
    const pending = pendingPremiumSyncRef.current;

    if (!pending || isUpgrading) {
      return;
    }

    if (!currentUserIdRef.current || currentUserIdRef.current !== pending.userId) {
      return;
    }

    const success = await syncPremiumAccess(
      pending.userId,
      pending.source,
      pending.accessToken,
    );

    if (!success && pendingPremiumSyncRef.current?.attempts && pendingPremiumSyncRef.current.attempts < 5) {
      const attempts = pendingPremiumSyncRef.current.attempts;
      const delayMs = Math.min(30000, 4000 * attempts);
      schedulePendingPremiumSyncRetry(delayMs);
    }
  }, [isUpgrading, schedulePendingPremiumSyncRetry, syncPremiumAccess]);

  const handleRestorePurchases = async () => {
    console.log('[IAP-FLOW] Restore: Starting manual restore process...');
    const resolvedUserId = await resolveUserIdFromWebView();
    const precheck = getRestorePrecheck(Platform.OS, resolvedUserId);

    if (precheck === 'unsupported-platform') {
      showToast('Restore purchases is not supported on this platform.', 'info');
      return;
    }

    if (precheck === 'missing-user') {
      console.warn('[IAP] Restore aborted: missing user ID');
      showToast('Please sign in to your account before restoring purchases.', 'info');
      return;
    }

    const restoreUserId = resolvedUserId;
    if (!isStoreConnected) {
      console.log('[IAP] Store disconnected during restore, attempting reconnect...');
      if (storeErrorReason && !isRetryableStoreError(storeErrorReason)) {
        showToast(getStoreErrorMessage(storeErrorReason), 'error');
      } else {
        showToast('Connecting to store, please wait...', 'info');
        try {
          await reconnect();
        } catch (reconnectError) {
          console.warn('[IAP] Reconnect for restore failed:', reconnectError);
          showToast('Failed to connect to store. Please try again.', 'error');
          return;
        }
      }
    }

    setIsUpgrading(true);
    setRestoreStatus('restoring');

    try {
      const purchases = await getAvailablePurchasesDirect();
      const matchingPurchase = findLifetimePurchase(purchases);
      const hasActiveSubscription = !!matchingPurchase;

      console.log(`[IAP-FLOW] Restore: Store returned ${purchases.length} total purchases. Matching found: ${hasActiveSubscription}`);

      if (matchingPurchase) {
        pendingPurchaseFinishRef.current = matchingPurchase;
      }

      let synced = false;
      if (hasActiveSubscription && restoreUserId) {
        synced = await syncPremiumAccess(
          restoreUserId,
          'restore',
          currentAccessTokenRef.current,
        );
      }

      const restoreToast = getRestoreCompletionToast(
        hasActiveSubscription,
        synced,
      );

      setRestoreStatus(
        hasActiveSubscription && synced ? 'restored' : 'not-found',
      );

      if (restoreToast) {
        showToast(restoreToast.message, restoreToast.type);
      }
    } catch (error) {
      console.error('[IAP] Manual restore failed:', error);
      setRestoreStatus('failed');
      showToast('Could not restore purchases right now.', 'error');
    } finally {
      clearUpgradeState();
    }
  };

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    currentAccessTokenRef.current = currentAccessToken;
  }, [currentAccessToken]);

  useEffect(() => {
    if (!showSplash) {
      BootSplash.hide({ fade: true }).catch(() => {});
    }
  }, [showSplash]);

  useEffect(() => {
    return () => {
      if (sessionSyncTimeoutRef.current) {
        clearTimeout(sessionSyncTimeoutRef.current);
      }

      if (premiumSyncRetryTimeoutRef.current) {
        clearTimeout(premiumSyncRetryTimeoutRef.current);
      }

      if (upgradeWatchdogTimeoutRef.current) {
        clearTimeout(upgradeWatchdogTimeoutRef.current);
      }

      if (productFetchRetryTimeoutRef.current) {
        clearTimeout(productFetchRetryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      setIsConnected(state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isStoreConnected) {
      return;
    }

    // Clear any previous error on reconnection
    setStoreErrorReason(null);
    productFetchAttemptsRef.current = 0;

    const attemptFetch = () => {
      Promise.all([
        fetchProducts({
          skus: IAP_PRODUCT_IDS,
          type: IAP_PRODUCT_TYPE,
        }),
        fetchProducts({
          skus: IAP_PRODUCT_IDS,
          type: 'subs',
        }).catch(() => {})
      ]).then(() => {
        productFetchAttemptsRef.current = 0;
      }).catch(error => {
        console.warn('[IAP] Product fetch failed:', error);
        const reason = classifyStoreError(error as { code?: string; message?: string });
        setStoreErrorReason(reason);

        // Retry for transient errors, up to 3 attempts
        if (isRetryableStoreError(reason) && productFetchAttemptsRef.current < 3) {
          productFetchAttemptsRef.current += 1;
          const delay = Math.min(15000, 3000 * Math.pow(2, productFetchAttemptsRef.current - 1));
          productFetchRetryTimeoutRef.current = setTimeout(attemptFetch, delay);
        }
      });
    };

    attemptFetch();

    return () => {
      if (productFetchRetryTimeoutRef.current) {
        clearTimeout(productFetchRetryTimeoutRef.current);
        productFetchRetryTimeoutRef.current = null;
      }
    };
  }, [fetchProducts, isStoreConnected]);

  useEffect(() => {
    if (!currentUserId || currentUserSubscription === 'premium' || !isStoreConnected) {
      return;
    }

    if (premiumConfirmedRef.current || lastAutoSyncedUserRef.current === currentUserId) {
      return;
    }

    let cancelled = false;

    const syncExistingPurchase = async () => {
      const purchases = await getAvailablePurchasesDirect();
      const matchingPurchase = findLifetimePurchase(purchases);

      if (!matchingPurchase || cancelled) {
        return;
      }

      pendingPurchaseFinishRef.current = matchingPurchase;

      console.log('[IAP-FLOW] Sync: Found existing lifetime purchase, syncing premium access silently');

      const synced = await syncPremiumAccess(
        currentUserId,
        'restore',
        currentAccessTokenRef.current,
      );

      if (synced && !cancelled) {
        setRestoreStatus('restored');
      }
    };

    syncExistingPurchase().catch(error => {
      console.log('[IAP] Existing purchase sync skipped:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    currentUserId,
    currentUserSubscription,
    isStoreConnected,
    syncPremiumAccess,
  ]);

  useEffect(() => {
    if (
      !pendingPurchaseFinishRef.current ||
      currentUserSubscription !== 'premium' ||
      !isStoreConnected
    ) {
      return;
    }

    finalizePendingPurchaseTransaction().catch(error => {
      console.warn('[IAP] Pending transaction finish retry failed:', error);
    });
  }, [currentUserSubscription, isStoreConnected]);

  useEffect(() => {
    if (!currentUserId || !pendingPremiumSyncRef.current) {
      return;
    }

    flushPendingPremiumSync().catch(error => {
      console.warn('[IAP] Pending premium sync retry failed:', error);
    });
  }, [currentUserId, currentAccessToken, isConnected, flushPendingPremiumSync]);

  const handleRetryVideo = async () => {
    setIsRetrying(true);
    setShowSplash(true);

    NetInfo.fetch().then((state: any) => {
      setIsConnected(state.isConnected);
      setIsRetrying(false);
      if (state.isConnected && webViewRef.current) {
        webViewRef.current.reload();
      } else {
        setShowSplash(false);
      }
    });
  };

  const startNativePurchase = async (
    purchaseUserId?: string | null,
    purchaseAccessToken?: string | null,
  ) => {
    console.log(`[IAP-FLOW] Initiation: Attempting to start native purchase for user: ${purchaseUserId || currentUserIdRef.current || 'unknown'}`);
    if (currentUserSubscription === 'premium' || premiumConfirmedRef.current) {
      console.log('[IAP-FLOW] Initiation: Aborted - user already has premium');
      showToast('You already have premium access!', 'info');
      return;
    }

    if (isUpgrading) {
      return;
    }

    if (pendingPurchaseFinishRef.current) {
      showToast('We are still finishing your previous purchase. Please wait a moment.', 'info');
      return;
    }

    if (!isStoreConnected) {
      // If store never connected, try to reconnect
      if (storeErrorReason && !isRetryableStoreError(storeErrorReason)) {
        showToast(getStoreErrorMessage(storeErrorReason), 'error');
      } else {
        showToast('Connecting to store, please wait...', 'info');
        try {
          await reconnect();
        } catch (reconnectError) {
          console.warn('[IAP] Reconnect failed:', reconnectError);
          showToast(
            getStoreErrorMessage(
              classifyStoreError(reconnectError as { code?: string; message?: string }),
            ),
            'error',
          );
        }
      }
      return;
    }

    const effectiveUserId = purchaseUserId ?? currentUserIdRef.current ?? (await resolveUserIdFromWebView());

    if (!effectiveUserId) {
      showToast('Could not detect your session. Please try again.', 'info');
      requestSessionSnapshot();
      return;
    }

    if (typeof purchaseAccessToken === 'string' || purchaseAccessToken === null) {
      setCurrentAccessToken(purchaseAccessToken ?? null);
      currentAccessTokenRef.current = purchaseAccessToken ?? null;
    }

    if (effectiveUserId !== currentUserIdRef.current) {
      setCurrentUserId(effectiveUserId);
      currentUserIdRef.current = effectiveUserId;
    }

    if (!lifetimeProduct) {
      // Distinguish between "products haven't loaded yet" vs "store error"
      if (storeErrorReason) {
        showToast(getStoreErrorMessage(storeErrorReason), 'error');
      } else {
        showToast(getUnavailablePurchaseMessage(), 'info');
      }
      Promise.all([
        fetchProducts({
          skus: IAP_PRODUCT_IDS,
          type: IAP_PRODUCT_TYPE,
        }),
        fetchProducts({
          skus: IAP_PRODUCT_IDS,
          type: 'subs',
        }).catch(() => {})
      ]).catch(error => {
        console.warn('[IAP] Product refresh failed:', error);
      });
      return;
    }

    clearPendingPurchaseSessionSync();

    console.log(`[IAP-FLOW] Initiation: Requesting store purchase for SKU: ${IAP_LIFETIME_PRODUCT_ID}`);
    try {
      beginUpgradeState();
      await requestPurchase({
        request: {
          apple: { sku: IAP_LIFETIME_PRODUCT_ID },
          google: { skus: [IAP_LIFETIME_PRODUCT_ID] },
        },
        type: IAP_PRODUCT_TYPE,
      });
      console.log('[IAP-FLOW] Initiation: Store modal shown successfully');
    } catch (err: any) {
      clearUpgradeState();
      showToast(getPurchaseErrorMessage(err), 'error');
      return;
    }
  };

  const onShouldStartLoadWithRequest = (request: any) => {
    const url = request?.url;

    if (url) {
      setCurrentUrl(url);
    }

    return true;
  };

  const onMessage = (event: any) => {
    try {
      const data = event.nativeEvent.data;

      // Try to parse as JSON
      if (data && data.startsWith('{')) {
        const parsed = JSON.parse(data);

        if (parsed.type === 'TRIGGER_NATIVE_IAP') {
            console.log('[IAP-FLOW] Bridge: Received TRIGGER_NATIVE_IAP message from WebView');
            startNativePurchase(parsed.userId, parsed.accessToken);
            return;
        }

          if (parsed.type === 'URL_CHANGED') {
            if (parsed.url !== currentUrl) {
                console.log('[Navigation] SPA Route:', parsed.path);
                setCurrentUrl(parsed.url);
            }
            return;
          }

          // Handle session data updates
          if (parsed.type === 'SESSION_DATA') {
          if (parsed.userId !== currentUserId) {
            console.log('[Session] User ID:', parsed.userId);
            setCurrentUserId(parsed.userId);
          }
          currentUserIdRef.current = parsed.userId ?? null;
          if (typeof parsed.accessToken === 'string' || parsed.accessToken === null) {
            setCurrentAccessToken(parsed.accessToken ?? null);
            currentAccessTokenRef.current = parsed.accessToken ?? null;
          }
          if (parsed.subscription !== currentUserSubscription) {
            if (premiumConfirmedRef.current && parsed.subscription !== 'premium') {
              // The backend has confirmed premium, but the webview is still showing old state.
              // We log this once as information then ignore subsequent 'free' signals.
              if (currentUserSubscription === 'premium') {
                  // Already set to premium, no need to log again unless it's a new 'free' signal
              } else {
                  console.log(`[IAP-FLOW] State: Ignoring WebView 'free' signal for user ${parsed.userId} (Premium confirmed by backend)`);
              }
            } else {
              console.log('[Session] Subscription:', parsed.subscription);
              setCurrentUserSubscription(parsed.subscription);
            }
          }

          if (sessionSnapshotResolverRef.current) {
            sessionSnapshotResolverRef.current(parsed.userId ?? null);
            sessionSnapshotResolverRef.current = null;
          }

          if (pendingPurchaseAfterSessionSyncRef.current && parsed.userId) {
            clearPendingPurchaseSessionSync();
            startNativePurchase(parsed.userId, parsed.accessToken ?? currentAccessTokenRef.current);
          }

          return;
        }

        // Handle IAP trigger from website
        if (parsed.type === 'TRIGGER_IAP') {
          console.log(
            '[IAP] Trigger received from website, userId:',
            parsed.userId,
            'cached:',
            currentUserId,
          );

          const subscription = parsed.subscription || currentUserSubscription;

          // If user already has premium, no need to purchase
          if (subscription === 'premium' || premiumConfirmedRef.current) {
            showToast('You already have premium access!', 'info');
            return;
          }

          // Update cached userId if it came from JS side
          if (parsed.userId && parsed.userId !== currentUserId) {
            setCurrentUserId(parsed.userId);
          }

          if (typeof parsed.accessToken === 'string' || parsed.accessToken === null) {
            setCurrentAccessToken(parsed.accessToken ?? null);
            currentAccessTokenRef.current = parsed.accessToken ?? null;
          }

          startNativePurchase(
            parsed.userId || currentUserId,
            parsed.accessToken ?? currentAccessTokenRef.current,
          );
          return;
        }
      }
    } catch (err) {
      console.warn('[WebView] Message Error:', err);
    }
  };

  // SIMPLIFIED - No event listeners, just session extraction + exposed IAP trigger
    const INJECTED_JAVASCRIPT = `(function() {
    console.log('[IAP] Script injected v8 - keyboard and session helpers');

    function injectAppKeyboardStyles() {
      if (document.getElementById('ttb-native-keyboard-style')) return;

      var style = document.createElement('style');
      style.id = 'ttb-native-keyboard-style';
      style.textContent = [
        'html.ttb-keyboard-open, body.ttb-keyboard-open {',
        '  height: auto !important;',
        '  overflow-y: auto !important;',
        '}',
        'body.ttb-keyboard-open {',
        '  padding-bottom: calc(var(--ttb-keyboard-offset, 0px) + 24px) !important;',
        '}',
        'body.ttb-keyboard-open [style*="position: fixed"][style*="bottom"],',
        'body.ttb-keyboard-open nav,',
        'body.ttb-keyboard-open footer,',
        'body.ttb-keyboard-open [role="navigation"],',
        'body.ttb-keyboard-open .bottom-nav,',
        'body.ttb-keyboard-open .mobile-bottom-nav,',
        'body.ttb-keyboard-open .mobile-nav,',
        'body.ttb-keyboard-open .sticky-bottom,',
        'body.ttb-keyboard-open .chat-input-actions {',
        '  opacity: 0 !important;',
        '  pointer-events: none !important;',
        '}',
        'input, textarea, [contenteditable="true"] {',
        '  scroll-margin-bottom: 180px !important;',
        '}'
      ].join('\n');

      document.head.appendChild(style);
    }

    function getKeyboardOffset() {
      try {
        if (window.visualViewport) {
          return Math.max(0, window.innerHeight - window.visualViewport.height);
        }
      } catch (e) {}
      return 0;
    }

    function applyKeyboardState(isOpen) {
      var offset = getKeyboardOffset();
      document.documentElement.style.setProperty('--ttb-keyboard-offset', offset + 'px');
      document.documentElement.classList.toggle('ttb-keyboard-open', isOpen);
      document.body && document.body.classList.toggle('ttb-keyboard-open', isOpen);
    }

    function ensureFocusedInputVisible(target) {
      if (!target || typeof target.scrollIntoView !== 'function') return;
      setTimeout(function() {
        try {
          target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        } catch (e) {
          try { target.scrollIntoView(); } catch (err) {}
        }
      }, 120);
    }

    function isEditableElement(target) {
      if (!target) return false;
      var tagName = (target.tagName || '').toLowerCase();
      return tagName === 'input' || tagName === 'textarea' || target.isContentEditable === true;
    }

    function relaxNameFieldLimits() {
      var selectors = [
        'input[name*="name" i]',
        'input[id*="name" i]',
        'input[placeholder*="name" i]',
        'input[autocomplete="name"]',
        'input[autocomplete="given-name"]',
        'input[autocomplete="additional-name"]',
        'input[autocomplete="family-name"]'
      ];

      selectors.forEach(function(selector) {
        var inputs = document.querySelectorAll(selector);
        inputs.forEach(function(input) {
          var maxLengthAttr = input.getAttribute('maxlength');
          if (maxLengthAttr && Number(maxLengthAttr) <= 22) {
            input.setAttribute('maxlength', '120');
          }
        });
      });
    }

    function installKeyboardHandlers() {
      injectAppKeyboardStyles();
      relaxNameFieldLimits();

      document.addEventListener('focusin', function(event) {
        var target = event.target;
        if (!isEditableElement(target)) return;
        applyKeyboardState(true);
        ensureFocusedInputVisible(target);
        relaxNameFieldLimits();
      }, true);

      document.addEventListener('focusout', function(event) {
        var target = event.target;
        if (!isEditableElement(target)) return;
        setTimeout(function() {
          var active = document.activeElement;
          applyKeyboardState(isEditableElement(active));
        }, 80);
      }, true);

      document.addEventListener('input', function(event) {
        var target = event.target;
        if (!isEditableElement(target)) return;
        relaxNameFieldLimits();
        ensureFocusedInputVisible(target);
      }, true);

      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', function() {
          var active = document.activeElement;
          applyKeyboardState(isEditableElement(active) || getKeyboardOffset() > 120);
          if (isEditableElement(active)) {
            ensureFocusedInputVisible(active);
          }
        });
      }

      window.addEventListener('resize', function() {
        var active = document.activeElement;
        applyKeyboardState(isEditableElement(active) || getKeyboardOffset() > 120);
      });

      var observer = new MutationObserver(function() {
        relaxNameFieldLimits();
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['maxlength', 'style', 'class']
      });
    }
    
    // Decode a JWT token string and return its payload as an object
    function decodeJWT(token) {
        try {
            if (!token || typeof token !== 'string') return null;
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            // Base64url decode the payload (middle part)
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
            const json = decodeURIComponent(
                atob(padded).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join('')
            );
            return JSON.parse(json);
        } catch(e) {
            console.log('[IAP] JWT decode error:', e);
            return null;
        }
    }

    // Read user from localStorage - supports direct user_id key and JWT formats
    function findSupabaseUser() {
        // PRIMARY: Check direct 'user_id' key in localStorage (set by the web app)
        try {
            const directUserId = localStorage.getItem('user_id');
            if (directUserId) {
                console.log('[IAP] Found user_id directly in localStorage:', directUserId);
                // Also try to get subscription info from the accessToken JWT
                let subscription = 'free';
                try {
                    const accessToken = localStorage.getItem('accessToken');
                    if (accessToken) {
                        const payload = decodeJWT(accessToken);
                        if (payload) {
                            subscription = payload.user_metadata?.subscription ||
                                          payload.subscription ||
                                          'free';
                        }
                    }
                } catch(e) {}
                return {
                    id: directUserId,
                  accessToken: localStorage.getItem('accessToken') || localStorage.getItem('authToken') || null,
                    subscription: subscription,
                    user_metadata: { subscription: subscription }
                };
            }
        } catch(e) {}

        // SECONDARY: website stores JWT directly under 'authToken'
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                const payload = decodeJWT(token);
                if (payload && payload.sub) {
                    console.log('[IAP] Found user from authToken JWT, sub:', payload.sub);
                    return {
                        id: payload.sub,
                        email: payload.email,
                      accessToken: token,
                        user_metadata: payload.user_metadata || {},
                        subscription: payload.user_metadata?.subscription || 'free'
                    };
                }
            }
        } catch(e) {}

        // SECONDARY: Check accessToken JWT for user id (sub claim)
        try {
            const accessToken = localStorage.getItem('accessToken');
            if (accessToken && accessToken.startsWith('eyJ')) {
                const payload = decodeJWT(accessToken);
                if (payload && payload.sub) {
                    console.log('[IAP] Found user from accessToken JWT, sub:', payload.sub);
                    return {
                        id: payload.sub,
                        email: payload.email,
                      accessToken: accessToken,
                        user_metadata: payload.user_metadata || {},
                        subscription: payload.user_metadata?.subscription || 'free'
                    };
                }
            }
        } catch(e) {}

        // FALLBACK: scan all keys in localStorage + sessionStorage
        const stores = [localStorage, sessionStorage];
        for (const store of stores) {
            try {
                for (let i = 0; i < store.length; i++) {
                    const key = store.key(i);
                    if (!key) continue;
                    try {
                        const raw = store.getItem(key);
                        if (!raw) continue;
                        // Try raw JWT format first
                        if (raw.startsWith('eyJ')) {
                            const payload = decodeJWT(raw);
                            if (payload && payload.sub) {
                                console.log('[IAP] Found JWT in key:', key);
                                return { id: payload.sub, accessToken: raw, user_metadata: payload.user_metadata || {} };
                            }
                        }
                        // Try JSON object format
                        const parsed = JSON.parse(raw);
                        if (!parsed) continue;
                        if (parsed.session && parsed.session.user && parsed.session.user.id) {
                            return parsed.session.user;
                        }
                        if (parsed.user && parsed.user.id) {
                            return parsed.user;
                        }
                        if (parsed.access_token && parsed.id) {
                            return parsed;
                        }
                    } catch(e) {}
                }
            } catch(e) {}
        }
        return null;
    }

    // Extract user session and subscription status
    function attemptExtractUser() {
        try {
            const user = findSupabaseUser();
            if (user) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'SESSION_DATA',
                    userId: user.id,
                    accessToken: user.accessToken || localStorage.getItem('accessToken') || localStorage.getItem('authToken') || null,
                    subscription: user.user_metadata?.subscription || 
                                 user.subscription || 
                                 'free'
                }));
            }
        } catch (e) {}
    }

    // Expose function for website to call
    window.triggerNativeIAP = function() {
        console.log('[IAP] triggerNativeIAP called');
        var user = null;
        var userId = null;
        var subscription = 'free';

        try {
            user = findSupabaseUser();
            if (user) {
                userId = user.id;
                subscription = user.user_metadata?.subscription || 
                              user.subscription || 
                              'free';
            }
        } catch(err) {}

        console.log('[IAP] Sending TRIGGER_IAP, userId:', userId, 'sub:', subscription);
        window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'TRIGGER_IAP',
            userId: userId,
            accessToken: (user && user.accessToken) || localStorage.getItem('accessToken') || localStorage.getItem('authToken') || null,
            subscription: subscription
        }));
    };

    // SPA Navigation Detection
    var lastPath = location.pathname;
    function checkPathChange() {
        if (location.pathname !== lastPath) {
            lastPath = location.pathname;
            console.log('[IAP] Path changed to:', lastPath);
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'URL_CHANGED',
                url: location.href,
                path: location.pathname
            }));
            attemptExtractUser();
        }
    }

    // Hook into History API for SPAs
    var originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        checkPathChange();
    };
    var originalReplaceState = history.replaceState;
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        checkPathChange();
    };
    window.addEventListener('popstate', checkPathChange);

    window.__ttbAttemptExtractUser = attemptExtractUser;

    // Initial extraction
    attemptExtractUser();
    installKeyboardHandlers();
    
    // Periodic check and recovery
    setInterval(function() {
      attemptExtractUser();
      checkPathChange();
      relaxNameFieldLimits();
    }, 2000);

    console.log('[IAP] window.triggerNativeIAP is now available');
  })();`;

  const showNativeUpgradeOverlay =
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
    currentUserSubscription !== 'premium' &&
    (currentUrl.toLowerCase().includes('/premium-upgrade') || 
     currentUrl.toLowerCase().includes('/profile') ||
     currentUrl.toLowerCase().includes('/account') ||
     currentUrl.toLowerCase().includes('/dashboard') ||
     currentUrl.toLowerCase().includes('/settings') ||
     currentUrl.toLowerCase().includes('/membership') ||
     currentUrl.toLowerCase().includes('/subscription'));

  return (
    <>
    <View
      style={[
        styles.container,
        { backgroundColor: '#FBFCFC', paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar backgroundColor="#160478" barStyle="light-content" />
      <View style={{ height: insets.top, backgroundColor: '#160478' }} />
      {!isConnected && (
        <NoInternetScreen onRetry={handleRetryVideo} isRetrying={isRetrying} />
      )}
      <WebView
        key={webViewInstanceKey}
        ref={webViewRef}
        source={{ uri: 'https://theorytestbangla.co.uk' }}
        onLoad={(event: any) => {
          setCurrentUrl(event.nativeEvent.url);
          setShowSplash(false);
          setTimeout(() => requestSessionSnapshot(), 500);
        }}
        // onError={() => {
        //   console.log('WebView Load Error');
        //   setShowSplash(false);
        // }}
        onNavigationStateChange={(navState: any) => {
          setCurrentUrl(navState.url);
          if (!currentUserIdRef.current) {
            requestSessionSnapshot();
          }
        }}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        injectedJavaScript={INJECTED_JAVASCRIPT}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JAVASCRIPT}
        onMessage={onMessage}
        // startInLoadingState={false}
        // allowsBackForwardNavigationGestures={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // Allow inline media playback
        // allowsInlineMediaPlayback={true}
        // mediaPlaybackRequiresUserAction={false}
        // userAgent={Platform.OS === 'android'
        //   ? "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36"
        //   : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
        // }
      />
      {showNativeUpgradeOverlay && (
        <View pointerEvents="box-none" style={styles.nativeUpgradeOverlay}>
          <Pressable
            accessibilityRole="button"
            disabled={isUpgrading}
            onPress={() => {
              startNativePurchase(currentUserId).catch(error => {
                console.warn('[IAP] Overlay purchase start failed:', error);
              });
            }}
            style={[
              styles.nativeUpgradeButton,
              isUpgrading && styles.nativeUpgradeButtonDisabled,
            ]}
            testID="native-upgrade-button"
          >
            <Text style={styles.nativeUpgradeButtonText}>
              {isUpgrading ? 'Starting purchase...' : 'Upgrade Now'}
            </Text>
          </Pressable>
          {shouldShowRestoreAction(Platform.OS, currentUserId, currentUserSubscription) && (
            <Pressable 
              onPress={handleRestorePurchases} 
              style={{ marginTop: 12, paddingVertical: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#160478', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' }}>
                {restoreStatus === 'restoring' ? 'Restoring Purchases...' : 'Restore Purchases'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {showSplash && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#160478',
              zIndex: 1000,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        />
      )}

      {shouldShowSubscriptionDebugMenu(Platform.OS, currentUserId) && (
        <SubscriptionDebugPanel
          visible={showSubscriptionTools}
          userId={currentUserId}
          subscription={currentUserSubscription}
          isStoreConnected={isStoreConnected}
          isBusy={isUpgrading}
          restoreStatus={restoreStatus}
          canRestore={shouldShowRestoreAction(
            Platform.OS,
            currentUserId,
            currentUserSubscription,
          )}
          onToggle={() => setShowSubscriptionTools(value => !value)}
          onRestore={handleRestorePurchases}
        />
      )}

      {/* Custom Toast Overlay */}
      {toast && (
        <View style={styles.toastContainer}>
          <View
            style={[
              styles.toast,
              toast.type === 'error'
                ? styles.toastError
                : toast.type === 'success'
                ? styles.toastSuccess
                : styles.toastInfo,
            ]}
          >
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </View>
      )}

      {/* Upgrading Overlay */}
      {isUpgrading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.loadingText}>Upgrading your account...</Text>
          </View>
        </View>
      )}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  nativeUpgradeOverlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 148,
    zIndex: 950,
  },
  nativeUpgradeButton: {
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    backgroundColor: '#9b00ff',
    shadowColor: '#25004d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 8,
  },
  nativeUpgradeButtonDisabled: {
    opacity: 0.65,
  },
  nativeUpgradeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 2000,
  },
  toast: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toastSuccess: {
    backgroundColor: '#4CAF50',
  },
  toastError: {
    backgroundColor: '#F44336',
  },
  toastInfo: {
    backgroundColor: '#2196F3',
  },
  toastText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#333',
    fontWeight: 'bold',
  },
});

export default App;
