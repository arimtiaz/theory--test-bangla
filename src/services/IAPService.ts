import { Platform } from 'react-native';
import type { Product, Purchase } from 'react-native-iap';
import { ErrorCode } from 'react-native-iap';

import { IAP_LIFETIME_PRODUCT_ID } from './IAPConfig';

export type StoreErrorReason =
    | 'billing-unavailable'
    | 'service-disconnected'
    | 'feature-not-supported'
    | 'network'
    | 'products-empty'
    | 'unknown';

export function findLifetimeProduct(productsOrSubs: any[]): any | null {
    return productsOrSubs.find(product => product.id === IAP_LIFETIME_PRODUCT_ID || product.productId === IAP_LIFETIME_PRODUCT_ID) ?? null;
}

export function findLifetimePurchase(purchases: Purchase[]): Purchase | null {
    return purchases.find(purchase => purchase.productId === IAP_LIFETIME_PRODUCT_ID) ?? null;
}

export function getUnavailablePurchaseMessage(): string {
    return 'Premium is temporarily unavailable. Please try again in a moment.';
}

export function classifyStoreError(error: { code?: string; message?: string }): StoreErrorReason {
    const code = error.code;

    if (code === ErrorCode.BillingUnavailable || code === ErrorCode.IapNotAvailable) {
        return 'billing-unavailable';
    }
    if (code === ErrorCode.ServiceDisconnected) {
        return 'service-disconnected';
    }
    if (code === ErrorCode.FeatureNotSupported) {
        return 'feature-not-supported';
    }
    if (code === ErrorCode.NetworkError || code === ErrorCode.RemoteError) {
        return 'network';
    }
    return 'unknown';
}

export function getStoreErrorMessage(reason: StoreErrorReason): string {
    const storeName = Platform.OS === 'ios' ? 'App Store' : 'Play Store';

    switch (reason) {
        case 'billing-unavailable':
            return Platform.OS === 'android'
                ? 'Billing is not available. Please update your Google Play Store app and make sure this app was installed from Google Play.'
                : `Could not connect to the ${storeName}. Please check your account settings and try again.`;
        case 'service-disconnected':
            return `${storeName} connection was lost. Please try again.`;
        case 'feature-not-supported':
            return 'In-app purchases are not supported on this device.';
        case 'network':
            return 'Network error. Please check your internet connection and try again.';
        case 'products-empty':
            return 'Premium is temporarily unavailable. Please try again in a moment.';
        case 'unknown':
        default:
            return 'Something went wrong with the store. Please try again later.';
    }
}

export function getPurchaseErrorMessage(error: { code?: string; message?: string }): string {
    const code = error.code;

    if (code === ErrorCode.UserCancelled) {
        return 'Purchase cancelled';
    }
    if (code === ErrorCode.AlreadyOwned) {
        return 'You already own this item. Try restoring your purchase.';
    }
    if (code === ErrorCode.DeveloperError) {
        return 'Purchase configuration error. Please contact support.';
    }
    if (code === ErrorCode.ItemUnavailable) {
        return 'This item is not available for purchase in your region.';
    }
    if (code === ErrorCode.DeferredPayment) {
        return 'Your purchase is pending approval. It will be activated once confirmed.';
    }
    if (code === ErrorCode.BillingUnavailable || code === ErrorCode.IapNotAvailable) {
        return Platform.OS === 'android'
            ? 'Billing is not available. Please update your Google Play Store app and make sure this app was installed from Google Play.'
            : 'Could not connect to the App Store. Please try again.';
    }
    if (code === ErrorCode.NetworkError || code === ErrorCode.RemoteError) {
        return 'Network error during purchase. Please check your connection and try again.';
    }

    return error.message || 'Could not complete purchase. Please try again.';
}

export function isRetryableStoreError(reason: StoreErrorReason): boolean {
    return reason === 'service-disconnected' || reason === 'network' || reason === 'unknown';
}