import * as crypto from 'crypto';
import { assertAuthorization, isObject } from './shared/validators';
import { Authorization } from './shared/schema';
import { ApiError } from './shared/ApiError';
import { validateServerHash } from './security';
import { MAX_PASSCODE_LENGTH } from './shared/constants';

export function verifySessionAuthority(
    bodyJSON: unknown,
    inviteData: { is_valid: boolean; passcode?: string }
): { authorized: boolean; verifiedPasscode?: string; isManual: boolean, cache_allowed: boolean } {
    try {
        // if authorizedRequest -> assertAuthorization checks auth structure
        // else -> we pass empty object to check if a global passcode is required
        const authBlock = isObject(bodyJSON) && 'auth' in bodyJSON ? bodyJSON.auth : null;

        if (!inviteData.is_valid && !authBlock) return { authorized: false, isManual: false, cache_allowed: false };

        const auth: Authorization = authBlock
            ? assertAuthorization(authBlock)
            : { invite: '' }; // a placeholder if user clicked on the embedded link and did not send anything in the body
        if (inviteData.is_valid) {
            // INVITE HASH WITH PASSCODE check
            if (inviteData.passcode !== undefined) {

                // relevance check
                if (checkGlobalPasscode(inviteData.passcode, true).isValid === false)
                    return { authorized: false, isManual: false, cache_allowed: false };

                // matching passcodes check
                if ('passcode' in auth) {
                    const { isValid, isLongTerm } = checkGlobalPasscode(auth.passcode);
                    return {
                        authorized: isValid,
                        isManual: true,
                        verifiedPasscode: isValid ? auth.passcode : undefined,
                        cache_allowed: isValid ? isLongTerm : false
                    };
                }

                return { authorized: true, verifiedPasscode: inviteData.passcode, isManual: false, cache_allowed: false };
            }

            // INVITE HASH WITHOUT PASSCODE -> MANUAL PASSCODE check
            if ('passcode' in auth) {
                const { isValid, isLongTerm } = checkGlobalPasscode(auth.passcode);
                return {
                    authorized: isValid,
                    isManual: true,
                    verifiedPasscode: isValid ? auth.passcode : undefined,
                    cache_allowed: isValid ? isLongTerm : false
                };
            }

            return { authorized: false, isManual: false, cache_allowed: false };
        }

        // MANUAL PASSCODE check
        if ('passcode' in auth) {
            const { isValid, isLongTerm } = checkGlobalPasscode(auth.passcode);
            return {
                authorized: isValid,
                isManual: true,
                verifiedPasscode: isValid ? auth.passcode : undefined,
                cache_allowed: isValid ? isLongTerm : false
            };
        }

        return { authorized: false, isManual: false, cache_allowed: false };

    } catch (err) {
        if (err instanceof ApiError) throw err;
        return { authorized: false, isManual: false, cache_allowed: false };
    }
}

// passcode '{clienHash}:{timestamp}'
function checkGlobalPasscode(passcode: unknown, ignoreTimestamp: boolean = false): {
    isLongTerm: boolean;
    isValid: boolean;
} {
    if (!passcode || typeof passcode !== 'string' || passcode.length > MAX_PASSCODE_LENGTH) {
        return { isValid: false, isLongTerm: false };
    }

    if (validateServerHash(passcode, ignoreTimestamp
        ? (1 * 60 * 60 * 1000)
        : (5 * 60 * 1000)
    ) === false) return { isValid: false, isLongTerm: false }

    const [clientHash, timestampStr] = (passcode || '').split(':');
    const inputBuffer = Buffer.from(clientHash, 'utf-8');


    const defaultPass = process.env.PASSCODE;
    const longTermPass = process.env.LONG_TERM_PASSCODE;

    const hmacKey = 'AAAAAAAHRRRRRasupercoolmegatopString';

    let isDefaultValid = false;
    if (defaultPass) {
        const serverExpectedHash = crypto.createHash('sha256').update(`${defaultPass}:${timestampStr}`).digest('hex');

        const inputHmac = crypto.createHmac('sha256', hmacKey).update(inputBuffer).digest();
        const targetHmac = crypto.createHmac('sha256', hmacKey).update(Buffer.from(serverExpectedHash, 'utf-8')).digest();

        isDefaultValid = crypto.timingSafeEqual(inputHmac, targetHmac);
    }

    let isLongTermValid = false;
    if (longTermPass) {
        const serverExpectedHash = crypto.createHash('sha256').update(`${longTermPass}:${timestampStr}`).digest('hex');

        const inputHmac = crypto.createHmac('sha256', hmacKey).update(inputBuffer).digest();
        const targetHmac = crypto.createHmac('sha256', hmacKey).update(Buffer.from(serverExpectedHash, 'utf-8')).digest();

        isLongTermValid = crypto.timingSafeEqual(inputHmac, targetHmac);
    }

    if (isDefaultValid) return { isValid: true, isLongTerm: false };
    if (isLongTermValid) return { isValid: true, isLongTerm: true };

    return { isValid: false, isLongTerm: false };
}