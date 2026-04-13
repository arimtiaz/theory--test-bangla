import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  getRestoreStatusLabel,
  getShortUserId,
  RestoreStatus,
  SubscriptionLevel,
} from '../services/subscriptionDebug';

type Props = {
  visible: boolean;
  userId: string | null;
  subscription: SubscriptionLevel;
  isStoreConnected: boolean;
  isBusy: boolean;
  restoreStatus: RestoreStatus;
  productCatalogStatus: string;
  productId: string;
  productPrice: string;
  storeErrorReason: string | null;
  lastStoreEvent: string;
  canRestore: boolean;
  onToggle: () => void;
  onRestore: () => void;
  onShareDiagnostics: () => void;
};

function SubscriptionDebugPanel({
  visible,
  userId,
  subscription,
  isStoreConnected,
  isBusy,
  restoreStatus,
  productCatalogStatus,
  productId,
  productPrice,
  storeErrorReason,
  lastStoreEvent,
  canRestore,
  onToggle,
  onRestore,
  onShareDiagnostics,
}: Props) {
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={onToggle}
        style={styles.trigger}
        testID="subscription-tools-trigger"
      >
        <Text style={styles.triggerText}>
          {visible ? 'Hide IAP Debug' : 'IAP Debug'}
        </Text>
      </Pressable>

      {visible && (
        <View style={styles.panel} testID="subscription-tools-panel">
          <Text style={styles.title}>Store Access Debug</Text>
          <View style={styles.row}>
            <Text style={styles.label}>User</Text>
            <Text style={styles.value}>{getShortUserId(userId)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Plan</Text>
            <Text style={styles.value}>{subscription ?? 'unknown'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Store</Text>
            <Text style={styles.value}>{isStoreConnected ? 'connected' : 'offline'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>SDK</Text>
            <Text style={styles.value}>react-native-iap</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Restore</Text>
            <Text style={styles.value}>{getRestoreStatusLabel(restoreStatus)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Catalog</Text>
            <Text style={styles.value}>{productCatalogStatus}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>SKU</Text>
            <Text style={styles.value}>{productId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Price</Text>
            <Text style={styles.value}>{productPrice}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Error</Text>
            <Text style={styles.value}>{storeErrorReason ?? 'none'}</Text>
          </View>
          <View style={styles.stack}>
            <Text style={styles.label}>Last Event</Text>
            <Text style={styles.eventValue}>{lastStoreEvent}</Text>
          </View>

          {canRestore && (
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={onRestore}
              style={[styles.restoreButton, isBusy && styles.restoreButtonDisabled]}
              testID="subscription-restore-button"
            >
              <Text style={styles.restoreButtonText}>
                {isBusy ? 'Working...' : 'Restore Purchases'}
              </Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={onShareDiagnostics}
            style={styles.shareButton}
            testID="subscription-share-diagnostics-button"
          >
            <Text style={styles.shareButtonText}>Share Diagnostics</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    position: 'absolute',
    right: 16,
    bottom: 112,
    zIndex: 1200,
    backgroundColor: '#132a63',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  triggerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  panel: {
    position: 'absolute',
    right: 16,
    bottom: 164,
    zIndex: 1200,
    width: 290,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    color: '#132a63',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  stack: {
    marginTop: 4,
    marginBottom: 8,
    gap: 6,
  },
  label: {
    color: '#51627a',
    fontSize: 12,
    fontWeight: '600',
  },
  value: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  eventValue: {
    color: '#0f172a',
    fontSize: 11,
    lineHeight: 16,
  },
  restoreButton: {
    marginTop: 10,
    alignItems: 'center',
    backgroundColor: '#160478',
    borderRadius: 12,
    paddingVertical: 10,
  },
  restoreButtonDisabled: {
    opacity: 0.6,
  },
  restoreButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  shareButton: {
    marginTop: 10,
    alignItems: 'center',
    backgroundColor: '#e6eef8',
    borderRadius: 12,
    paddingVertical: 10,
  },
  shareButtonText: {
    color: '#132a63',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default SubscriptionDebugPanel;
