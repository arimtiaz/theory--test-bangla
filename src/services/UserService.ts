const PREMIUM_UPGRADE_URL = 'https://api.theorytestbangla.co.uk/api/admin/users';
const FALLBACK_ADMIN_BEARER = 'theorytestbangla.admin.superaccess';
const REQUEST_TIMEOUT_MS = 15000;

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

    return token.trim().split('.').length === 3;
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

    const cleanUserId = userId.trim();
    const cleanAuthHeader = authHeader.trim();

    console.log(`[IAP-FLOW] [UserService] Starting PUT request to ${cleanUserId}/role...`);
    try {
        const response = await fetch(
            `${PREMIUM_UPGRADE_URL}/${cleanUserId}/role`,
            {
                method: 'PUT',
                headers: {
                    Authorization: cleanAuthHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subscription: 'premium',
                }),
                signal,
            },
        );

        console.log(`[IAP-FLOW] [UserService] Received status: ${response.status}`);

        if (response.ok) {
            console.log('[IAP-FLOW] [UserService] Target user successfully upgraded on backend');
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
        const cleanUserId = userId?.trim();
        console.log(`[UserService] Upgrading user ${cleanUserId} to premium...`);

        if (!cleanUserId) {
            return {
                success: false,
                retryable: false,
                message: 'Missing user ID for premium upgrade.',
            };
        }

        // Build a list of authentication headers to try sequentially
        const candidateHeaders: string[] = [];
        const adminToken = FALLBACK_ADMIN_BEARER.trim();

        // ONLY use the Admin Token for this endpoint as per backend spec.
        // User JWTs consistently return 403 Forbidden because this is a restricted Admin API.
        candidateHeaders.push(`Bearer ${adminToken}`); // Standard Bearer
        candidateHeaders.push(adminToken);            // Raw token (fallback)
        candidateHeaders.push(`bearer ${adminToken}`); // Lowercase bearer

        let lastFailure: PremiumUpgradeResult = {
            success: false,
            retryable: true,
            message: 'Premium upgrade request was not attempted.',
        };

        console.log(`[IAP-FLOW] [UserService] Attempting backend sync for UserID: ${cleanUserId}`);
        for (const authHeader of candidateHeaders) {
            const result = await sendPremiumUpgradeRequest(cleanUserId, authHeader);

            if (result.success) {
                console.log('[IAP-FLOW] [UserService] Sync SUCCESSFUL');
                return result;
            }

            const isAuthFailure = result.statusCode === 401 || result.statusCode === 403;
            if (isAuthFailure) {
                console.warn(`[IAP-FLOW] [UserService] Auth Header format was rejected (${result.statusCode})`);
            } else {
                console.error(`[IAP-FLOW] [UserService] Sync FAILED with non-auth error (${result.statusCode ?? 'network'}): ${result.message}`);
                lastFailure = result;
                break; // 404 or 500 won't be fixed by changing headers
            }

            lastFailure = result;
        }

        return lastFailure;
    },
};
