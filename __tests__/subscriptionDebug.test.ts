import {
  getRestoreCompletionToast,
  getRestorePrecheck,
  getRestoreStatusLabel,
  getShortUserId,
  shouldShowRestoreAction,
  shouldShowSubscriptionDebugMenu,
} from '../src/services/subscriptionDebug';

describe('subscriptionDebug restore flow logic', () => {
  test('blocks restore on unsupported platforms', () => {
    expect(getRestorePrecheck('web', 'user-1')).toBe('unsupported-platform');
  });

  test('blocks restore when user is missing', () => {
    expect(getRestorePrecheck('ios', null)).toBe('missing-user');
  });

  test('allows restore when supported user is signed in', () => {
    expect(getRestorePrecheck('android', 'user-1')).toBe('ready');
    expect(getRestorePrecheck('ios', 'user-1')).toBe('ready');
  });

  test('shows debug menu only for signed in mobile users', () => {
    expect(shouldShowSubscriptionDebugMenu('ios', 'user-1')).toBe(true);
    expect(shouldShowSubscriptionDebugMenu('android', 'user-1')).toBe(true);
    expect(shouldShowSubscriptionDebugMenu('ios', null)).toBe(false);
    expect(shouldShowSubscriptionDebugMenu('web', 'user-1')).toBe(false);
  });

  test('shows restore action only when user is not already premium', () => {
    expect(shouldShowRestoreAction('ios', 'user-1', 'free')).toBe(true);
    expect(shouldShowRestoreAction('ios', 'user-1', 'premium')).toBe(false);
  });

  test('returns info toast when no active subscription exists', () => {
    expect(getRestoreCompletionToast(false, false)).toEqual({
      message: 'No active App Store or Play Store purchase was found.',
      type: 'info',
    });
  });

  test('returns success toast when restore sync succeeds', () => {
    expect(getRestoreCompletionToast(true, true)).toEqual({
      message: 'Premium access restored.',
      type: 'success',
    });
  });

  test('does not return a toast when store has subscription but backend sync did not complete', () => {
    expect(getRestoreCompletionToast(true, false)).toBeNull();
  });

  test('formats status labels for panel display', () => {
    expect(getRestoreStatusLabel('idle')).toBe('Idle');
    expect(getRestoreStatusLabel('restored')).toBe('Restored');
    expect(getRestoreStatusLabel('not-found')).toBe('No purchase found');
    expect(getRestoreStatusLabel('failed')).toBe('Restore failed');
  });

  test('shortens long user ids for the debug panel', () => {
    expect(getShortUserId('12345678901234567890')).toBe('123456...7890');
    expect(getShortUserId(null)).toBe('Not signed in');
  });
});