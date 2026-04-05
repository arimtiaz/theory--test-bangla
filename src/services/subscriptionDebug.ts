export type SubscriptionLevel = 'free' | 'premium' | null;
export type RestoreStatus =
  | 'idle'
  | 'restoring'
  | 'restored'
  | 'not-found'
  | 'failed';

export type ToastType = 'success' | 'error' | 'info';

export type RestorePrecheckResult =
  | 'unsupported-platform'
  | 'missing-user'
  | 'ready';

export function getRestorePrecheck(
  platformOS: string,
  userId: string | null,
): RestorePrecheckResult {
  if (platformOS !== 'ios' && platformOS !== 'android') {
    return 'unsupported-platform';
  }

  if (!userId) {
    return 'missing-user';
  }

  return 'ready';
}

export function shouldShowSubscriptionDebugMenu(
  platformOS: string,
  userId: string | null,
): boolean {
  // Show debug menu on mobile if user is present, or for general non-premium users on relevant pages
  return (platformOS === 'ios' || platformOS === 'android');
}

export function shouldShowRestoreAction(
  platformOS: string,
  userId: string | null,
  subscription: SubscriptionLevel,
): boolean {
  // Always show Restore on mobile if not already premium, even if logged out
  // (We will prompt to log in on click)
  return (platformOS === 'ios' || platformOS === 'android') && subscription !== 'premium';
}

export function getRestoreCompletionToast(
  hasActiveSubscription: boolean,
  synced: boolean,
): { message: string; type: ToastType } | null {
  if (!hasActiveSubscription) {
    return {
      message: 'No active App Store or Play Store purchase was found.',
      type: 'info',
    };
  }

  if (synced) {
    return {
      message: 'Premium access restored.',
      type: 'success',
    };
  }

  return null;
}

export function getRestoreStatusLabel(status: RestoreStatus): string {
  switch (status) {
    case 'restoring':
      return 'Restoring';
    case 'restored':
      return 'Restored';
    case 'not-found':
      return 'No purchase found';
    case 'failed':
      return 'Restore failed';
    default:
      return 'Idle';
  }
}

export function getShortUserId(userId: string | null): string {
  if (!userId) {
    return 'Not signed in';
  }

  if (userId.length <= 14) {
    return userId;
  }

  return `${userId.slice(0, 6)}...${userId.slice(-4)}`;
}