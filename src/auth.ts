import * as crypto from 'crypto';
import { assertAuthorization, isObject } from './shared/validators';
import { Authorization } from './shared/schema';
import { ApiError } from './shared/ApiError';


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
                if (checkGlobalPasscode(inviteData.passcode).isValid === false)
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

function checkGlobalPasscode(passcode: unknown): {
    isLongTerm: boolean;
    isValid: boolean;
} {
    const defaultPass = process.env.PASSCODE;
    const longTermPass = process.env.LONG_TERM_PASSCODE;

    if (!passcode || typeof passcode !== 'string') return { isValid: false, isLongTerm: false };

    if (defaultPass && passcode === defaultPass) try {
        if (crypto.timingSafeEqual(Buffer.from(passcode, 'utf-8'), Buffer.from(defaultPass, 'utf-8'))) {
            return { isValid: true, isLongTerm: false };
        }
    } catch {
        return { isValid: true, isLongTerm: false };
    }

    if (longTermPass && passcode === longTermPass) try {
        if (crypto.timingSafeEqual(Buffer.from(passcode, 'utf-8'), Buffer.from(longTermPass, 'utf-8'))) {
            return { isValid: true, isLongTerm: true };
        }
    } catch {
        return { isValid: true, isLongTerm: true };
    }

    return { isValid: false, isLongTerm: false };
}