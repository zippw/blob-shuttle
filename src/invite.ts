
import * as crypto from 'crypto';
import { validateVaultId, isObject } from './shared/validators';
import { sessionStorage } from './session';

const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
let SECRET_KEY: Buffer;

if (ENCRYPTION_SECRET) {
    SECRET_KEY = Buffer.from(ENCRYPTION_SECRET, 'hex');
    if (SECRET_KEY.length !== 32) throw new Error(`ENCRYPTION_KEY byte len=${SECRET_KEY.length} (expected: 32)`);
} else throw new Error('No process.env.ENCRYPTION_KEY configuration found');

type ValidInvite = {
    is_valid: true;
    vault_id: string;
    expires_at: number;
    expires_in_sec: number;
};

type InvalidInvite = { is_valid: false; };
export type InviteData = InvalidInvite | ValidInvite;
type DecodedInvite = InvalidInvite | (ValidInvite & { passcode?: string });


export interface InvitePayload {
    vault_id: string;
    expires_at: number;
    passcode?: string;
}


export function decodeInviteHash(inviteHash: unknown): DecodedInvite {
    if (typeof inviteHash !== 'string') return { is_valid: false };
    try {
        const buffer = Buffer.from(inviteHash, 'base64url');
        if (buffer.length < 29) return { is_valid: false };

        const iv = buffer.subarray(0, 12);
        const tag = buffer.subarray(12, 28);
        const encrypted = buffer.subarray(28);

        const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
        decipher.setAuthTag(tag);

        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
        const data = JSON.parse(decrypted);

        if (!data || typeof data !== 'object') return { is_valid: false };

        const vault_id = validateVaultId(data.vault_id);
        const expires_at = Number(data.expires_at);

        if (isNaN(expires_at) || Date.now() > expires_at) return { is_valid: false };

        return {
            is_valid: true,
            vault_id,
            expires_at,
            expires_in_sec: Math.floor((expires_at - Date.now()) / 1000),
            ...(typeof data.passcode === 'string' ? { passcode: data.passcode } : {})
        };
    } catch { return { is_valid: false }; }
}

export function generateInviteHash(payload: InvitePayload): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    const text = JSON.stringify(payload);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function createSessionInviteToken(targetVaultId: string): string {
    const store = sessionStorage.getStore();
    const expires_at = Date.now() + (60 * 60 * 1000);

    const passcode = store && typeof store.session.passcode === 'string'
        ? store.session.passcode
        : undefined;

    return generateInviteHash({ vault_id: targetVaultId, expires_at, passcode });
}


export function extractInviteToken(query: Record<string, string>, bodyJSON: unknown): string | undefined {
    if (query?.invite) return query.invite;

    if (isObject(bodyJSON) && isObject(bodyJSON.auth) && typeof bodyJSON.auth.invite === 'string')
        return bodyJSON.auth.invite;

    return undefined;
}