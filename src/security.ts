export function validateServerHash(hash: string, acceptableTimeError: number = 5 * 60 * 1000): boolean {
    try {
        const [clientHash, timestampStr] = hash.split(':');
        if (!clientHash || !timestampStr) {
            console.debug('[security] validateDynamicHash -> false (missing params)', clientHash, timestampStr)
            return false;
        }

        const timestamp = parseInt(timestampStr, 10);
        if (isNaN(timestamp)) {
            console.debug('[security] validateDynamicHash -> false (invalid timestamp)')
            return false;
        }

        const now = Date.now();
        if (Math.abs(now - timestamp) > acceptableTimeError) {
            console.debug('security] validateDynamicHash -> false (time mismatch)')
            return false;
        }

        return true;
    } catch (error) {
        console.debug('[security] validateDynamicHash -> false', error)
        return false;
    }
}
