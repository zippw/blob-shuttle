import * as crypto from 'crypto';
import { validateServerHash } from './security';
import { Authorization } from '#shared/schema.js';
import { ApiError } from '#shared/ApiError.js';
import { assertAuthorization, isObject, validateTimestamp } from '#shared/validators.js';
import cfg from './config/config';


function handleManualPasscode(passcode: string) {
    const { isValid, isLongTerm } = checkGlobalPasscode(passcode);
    return {
        authorized: isValid,
        isManual: true,
        verifiedPasscode: isValid ? passcode : undefined,
        cache_allowed: isValid ? isLongTerm : false
    };
}

function handleInviteHashWithPasscode(auth: Authorization, invitePasscode: string) {
    // relevance check
    if (checkGlobalPasscode(invitePasscode, true).isValid === false)
        return { authorized: false, isManual: false, cache_allowed: false };

    if ('passcode' in auth) return handleManualPasscode(auth.passcode); // if passcode from invite as correct as auth.passcode

    return { authorized: true, verifiedPasscode: invitePasscode, isManual: false, cache_allowed: false };
}

export function verifySessionAuthority(
    bodyJSON: unknown,
    inviteData: { is_valid: boolean; passcode?: string }
): { authorized: boolean; verifiedPasscode?: string; isManual: boolean, cache_allowed: boolean } {
    try {
        // authorizedRequest ? assertAuthorization checks auth structure
        // else we pass empty object to check if a global passcode is required

        const authBlock = isObject(bodyJSON) && 'auth' in bodyJSON ? bodyJSON.auth : null;
        if (!inviteData.is_valid && !authBlock) return { authorized: false, isManual: false, cache_allowed: false };

        const auth: Authorization = authBlock
            ? assertAuthorization(authBlock) // I'M HERE!
            : { invite: '' }; // a placeholder if user clicked on the embedded link and did not send anything in the body


        /* main logic */
        if (inviteData.is_valid) {
            if (inviteData.passcode !== undefined) return handleInviteHashWithPasscode(auth, inviteData.passcode);
            if ('passcode' in auth) return handleManualPasscode(auth.passcode);

            return { authorized: false, isManual: false, cache_allowed: false };
        }

        if ('passcode' in auth) return handleManualPasscode(auth.passcode);

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
    if (!passcode || typeof passcode !== 'string' || passcode.length > cfg.options.maxPasscodeLength) {
        return { isValid: false, isLongTerm: false };
    }

    if (validateServerHash(passcode, ignoreTimestamp
        ? (1 * 60 * 60 * 1000)
        : (5 * 60 * 1000)
    ) === false) return { isValid: false, isLongTerm: false }

    const [clientHash, timestampStr] = (passcode || '').split(':');
    const timestamp = validateTimestamp(timestampStr);

    const inputBuffer = Buffer.from(clientHash, 'utf-8');


    const defaultPass = process.env.PASSCODE;
    const longTermPass = process.env.LONG_TERM_PASSCODE;

    const HMAC_KEY = process.env.HMAC_KEY;
    if (!HMAC_KEY) throw new Error('HMAC_KEY required');

    let isDefaultValid = false;
    if (defaultPass) {
        const serverExpectedHash = crypto.createHash('sha256').update(`${defaultPass}:${timestamp}`).digest('hex');

        const inputHmac = crypto.createHmac('sha256', HMAC_KEY).update(inputBuffer).digest();
        const targetHmac = crypto.createHmac('sha256', HMAC_KEY).update(Buffer.from(serverExpectedHash, 'utf-8')).digest();

        isDefaultValid = crypto.timingSafeEqual(inputHmac, targetHmac);
    }

    let isLongTermValid = false;
    if (longTermPass) {
        const serverExpectedHash = crypto.createHash('sha256').update(`${longTermPass}:${timestamp}`).digest('hex');

        const inputHmac = crypto.createHmac('sha256', HMAC_KEY).update(inputBuffer).digest();
        const targetHmac = crypto.createHmac('sha256', HMAC_KEY).update(Buffer.from(serverExpectedHash, 'utf-8')).digest();

        isLongTermValid = crypto.timingSafeEqual(inputHmac, targetHmac);
    }

    if (isDefaultValid) return { isValid: true, isLongTerm: false };
    if (isLongTermValid) return { isValid: true, isLongTerm: true };

    return { isValid: false, isLongTerm: false };
}