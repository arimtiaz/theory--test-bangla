import { Platform } from 'react-native';
import {
  classifyStoreError,
  getStoreErrorMessage,
  getPurchaseErrorMessage,
  isRetryableStoreError,
} from '../src/services/IAPService';

describe('classifyStoreError', () => {
  test('classifies billing-unavailable errors', () => {
    expect(classifyStoreError({ code: 'billing-unavailable' })).toBe('billing-unavailable');
    expect(classifyStoreError({ code: 'iap-not-available' })).toBe('billing-unavailable');
  });

  test('classifies service-disconnected errors', () => {
    expect(classifyStoreError({ code: 'service-disconnected' })).toBe('service-disconnected');
  });

  test('classifies feature-not-supported errors', () => {
    expect(classifyStoreError({ code: 'feature-not-supported' })).toBe('feature-not-supported');
  });

  test('classifies network errors', () => {
    expect(classifyStoreError({ code: 'network-error' })).toBe('network');
    expect(classifyStoreError({ code: 'remote-error' })).toBe('network');
  });

  test('classifies unknown errors', () => {
    expect(classifyStoreError({ code: 'something-weird' })).toBe('unknown');
    expect(classifyStoreError({})).toBe('unknown');
  });
});

describe('getStoreErrorMessage', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform });
  });

  test('returns Android-specific billing unavailable message', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    const msg = getStoreErrorMessage('billing-unavailable');
    expect(msg).toContain('Google Play Store');
  });

  test('returns iOS-specific billing unavailable message', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const msg = getStoreErrorMessage('billing-unavailable');
    expect(msg).toContain('App Store');
  });

  test('returns service disconnected message', () => {
    const msg = getStoreErrorMessage('service-disconnected');
    expect(msg).toContain('connection was lost');
  });

  test('returns feature not supported message', () => {
    const msg = getStoreErrorMessage('feature-not-supported');
    expect(msg).toContain('not supported');
  });

  test('returns network error message', () => {
    const msg = getStoreErrorMessage('network');
    expect(msg).toContain('internet connection');
  });

  test('returns products-empty message', () => {
    const msg = getStoreErrorMessage('products-empty');
    expect(msg).toContain('temporarily unavailable');
  });

  test('returns generic unknown message', () => {
    const msg = getStoreErrorMessage('unknown');
    expect(msg).toContain('Something went wrong');
  });
});

describe('getPurchaseErrorMessage', () => {
  test('returns cancel message for user-cancelled', () => {
    expect(getPurchaseErrorMessage({ code: 'user-cancelled' })).toBe('Purchase cancelled');
  });

  test('returns already-owned message with restore hint', () => {
    const msg = getPurchaseErrorMessage({ code: 'already-owned' });
    expect(msg).toContain('already own');
    expect(msg.toLowerCase()).toContain('restor');
  });

  test('returns developer error message', () => {
    const msg = getPurchaseErrorMessage({ code: 'developer-error' });
    expect(msg).toContain('contact support');
  });

  test('returns item unavailable message', () => {
    const msg = getPurchaseErrorMessage({ code: 'item-unavailable' });
    expect(msg).toContain('not available');
  });

  test('returns deferred payment message', () => {
    const msg = getPurchaseErrorMessage({ code: 'deferred-payment' });
    expect(msg).toContain('pending approval');
  });

  test('returns billing unavailable message for Android', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    const msg = getPurchaseErrorMessage({ code: 'billing-unavailable' });
    expect(msg).toContain('Google Play Store');
  });

  test('returns network error message', () => {
    const msg = getPurchaseErrorMessage({ code: 'network-error' });
    expect(msg).toContain('Network error');
  });

  test('falls back to error.message for unknown codes', () => {
    const msg = getPurchaseErrorMessage({ code: 'weird', message: 'Custom error' });
    expect(msg).toBe('Custom error');
  });

  test('falls back to generic message when no code or message', () => {
    const msg = getPurchaseErrorMessage({});
    expect(msg).toContain('Could not complete purchase');
  });
});

describe('isRetryableStoreError', () => {
  test('service-disconnected is retryable', () => {
    expect(isRetryableStoreError('service-disconnected')).toBe(true);
  });

  test('network is retryable', () => {
    expect(isRetryableStoreError('network')).toBe(true);
  });

  test('unknown is retryable', () => {
    expect(isRetryableStoreError('unknown')).toBe(true);
  });

  test('billing-unavailable is not retryable', () => {
    expect(isRetryableStoreError('billing-unavailable')).toBe(false);
  });

  test('feature-not-supported is not retryable', () => {
    expect(isRetryableStoreError('feature-not-supported')).toBe(false);
  });

  test('products-empty is not retryable', () => {
    expect(isRetryableStoreError('products-empty')).toBe(false);
  });
});
