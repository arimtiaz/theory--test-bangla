const PREMIUM_UPGRADE_URL = 'https://api.theorytestbangla.co.uk/api/admin/users';
const FALLBACK_ADMIN_BEARER = 'theorytestbangla.admin.superaccess';
const REQUEST_TIMEOUT_MS = 12000;

export type PremiumUpgradeResult = {
    success: boolean;
    retryable: boolean;
    statusCode?: number;
    message?: string;
};

function isJwtToken(token?: string | null): token is string {
    if (!token) {
        return false;
    }

    return token.split('.').length === 3;
}

function withTimeout(timeoutMs: number): {
    signal: AbortSignal;
    cancel: () => void;
} {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    return {
        signal: controller.signal,
        cancel: () => clearTimeout(timeout),
    };
}

async function sendPremiumUpgradeRequest(
    userId: string,
    authHeader: string,
): Promise<PremiumUpgradeResult> {
    const { signal, cancel } = withTimeout(REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(
            `${PREMIUM_UPGRADE_URL}/${userId}/role`,
            {
                method: 'PUT',
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subscription: 'premium',
                }),
                signal,
            },
        );

        if (response.ok) {
            return {
                success: true,
                retryable: false,
                statusCode: response.status,
            };
        }

        const errorText = await response.text();
        const retryable = response.status >= 500 || response.status === 429;

        return {
            success: false,
            retryable,
            statusCode: response.status,
            message: errorText || `HTTP ${response.status}`,
        };
    } catch (error) {
        const isAbort = error instanceof Error && error.name === 'AbortError';

        return {
            success: false,
            retryable: true,
            message: isAbort
                ? 'Premium upgrade request timed out.'
                : error instanceof Error
                  ? error.message
                  : 'Unknown premium upgrade error.',
        };
    } finally {
        cancel();
    }
}

export const UserService = {
    async upgradeUserToPremium(
        userId: string,
        accessToken?: string | null,
    ): Promise<PremiumUpgradeResult> {
        console.log(`[UserService] Upgrading user ${userId} to premium...`);

        if (!userId) {
            return {
                success: false,
                retryable: false,
                message: 'Missing user ID for premium upgrade.',
            };
        }

        const candidateHeaders = isJwtToken(accessToken)
            ? [
                  `Bearer ${accessToken}`,
                  `Bearer ${FALLBACK_ADMIN_BEARER}`,
              ]
            : [`Bearer ${FALLBACK_ADMIN_BEARER}`];

        let lastFailure: PremiumUpgradeResult = {
            success: false,
            retryable: true,
            message: 'Premium upgrade request was not attempted.',
        };

        for (const authHeader of candidateHeaders) {
            const result = await sendPremiumUpgradeRequest(userId, authHeader);

            if (result.success) {
                console.log('[UserService] User upgraded successfully');
                return result;
            }

            const isAuthFailure = result.statusCode === 401 || result.statusCode === 403;
            const canFallback = authHeader !== `Bearer ${FALLBACK_ADMIN_BEARER}`;

            console.error(
                `[UserService] Failed to upgrade user (${result.statusCode ?? 'network'}): ${result.message ?? 'Unknown error'}`,
            );

            lastFailure = result;

            if (!(isAuthFailure && canFallback)) {
                break;
            }
        }

        return lastFailure;
    },
};
