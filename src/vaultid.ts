import { createHmac } from 'crypto';

const rawSecretKey = process.env.VAULT_SECRET_KEY;
if (!rawSecretKey) throw new Error('No process.env.VAULT_SECRET_KEY configuration found');


let SECRET_KEY: string = rawSecretKey;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// 10 ms precision reduces the collision window drastically.
// With 26 bits for time, 10ms blocks give exactly 7.76 days of uniqueness.
const TIME_BLOCK_MS = 10;
const TOTAL_TIME_BLOCKS = 0x03ffffff; // 2^26 - 1
const LOOP_DURATION_MS = TOTAL_TIME_BLOCKS * TIME_BLOCK_MS;
const DAYS_OF_UNIQUENESS = LOOP_DURATION_MS / (1000 * 60 * 60 * 24);

console.log(`[VaultCrypto] Configured with ${TIME_BLOCK_MS}ms blocks. Uniqueness lifespan: ${DAYS_OF_UNIQUENESS.toFixed(2)} days.`);


function feistel(value: number, key: string, decrypt = false): number {
    let left = (value >>> 16) & 0xffff;
    let right = value & 0xffff;

    for (let i = 0; i < 4; i++) {
        const round = decrypt ? 3 - i : i;
        const nextLeft = right;

        const hmac = createHmac('sha256', key);
        hmac.update(Buffer.from([round, (right >>> 8) & 0xff, right & 0xff]));
        const fResult = hmac.digest().readUInt16BE(0);

        const nextRight = (left ^ fResult) & 0xffff;
        left = right;
        right = nextRight;
    }
    return decrypt ? ((right << 16) | left) >>> 0 : ((left << 16) | right) >>> 0;
}

function toBase62(num: number): string {
    let encoded = '';
    while (num > 0) {
        encoded = ALPHABET[num % 62] + encoded;
        num = Math.floor(num / 62);
    }
    return encoded.padStart(6, 'a');
}

function fromBase62(str: string): number {
    let num = 0;
    for (let i = 0; i < str.length; i++) {
        const idx = ALPHABET.indexOf(str[i]);
        if (idx === -1) return 0;
        num = num * 62 + idx;
    }
    return num;
}

/**
 * Generates a cryptographically secure, unique 6-character ID.
 * Collision info: Will duplicate only if called multiple times within the SAME ${TIME_BLOCK_MS}ms window.
 */
export function generateVaultId(): string {
    // 1. Get current time block, masked to fit 26 bits
    const timeBlock = Math.floor(Date.now() / TIME_BLOCK_MS) & TOTAL_TIME_BLOCKS;

    // 2. Calculate a 6-bit checksum
    const hmac = createHmac('sha256', SECRET_KEY);
    hmac.update(Buffer.from([(timeBlock >>> 24) & 0xff, (timeBlock >>> 16) & 0xff, (timeBlock >>> 8) & 0xff, timeBlock & 0xff]));
    const checksum = hmac.digest().readUInt8(0) & 0x3f;

    // 3. Pack: [ 26 bits time | 6 bits checksum ]
    const packed = ((timeBlock << 6) | checksum) >>> 0;

    return toBase62(feistel(packed, SECRET_KEY, false));
}

/**
 * Checks if the ID contains a mathematically valid checksum.
 */
function isValidVaultId(id: string): boolean {
    if (!id || id.length !== 6) return false;

    const decrypted = feistel(fromBase62(id), SECRET_KEY, true);
    const timeBlock = (decrypted >>> 6) & TOTAL_TIME_BLOCKS;
    const embeddedChecksum = decrypted & 0x3f;

    const hmac = createHmac('sha256', SECRET_KEY);
    hmac.update(Buffer.from([(timeBlock >>> 24) & 0xff, (timeBlock >>> 16) & 0xff, (timeBlock >>> 8) & 0xff, timeBlock & 0xff]));
    const actualChecksum = hmac.digest().readUInt8(0) & 0x3f;

    return embeddedChecksum === actualChecksum;
}

/**
 * Decodes the 6-character ID back into an approximate Date object (accurate to ${TIME_BLOCK_MS}ms).
 * Returns null if the checksum validation fails.
 */
export function decodeVaultId(id: string): Date | null {
    if (!isValidVaultId(id)) return null;

    const decrypted = feistel(fromBase62(id), SECRET_KEY, true);
    const timeBlock = (decrypted >>> 6) & TOTAL_TIME_BLOCKS;

    const nowMs = Date.now();
    const baseEpoch = Math.floor(nowMs / LOOP_DURATION_MS) * LOOP_DURATION_MS;

    let targetMs = baseEpoch + (timeBlock * TIME_BLOCK_MS);

    // Handle edge case if the ID belongs to the previous loop window
    if (targetMs > nowMs + 3600000) targetMs -= LOOP_DURATION_MS;

    return new Date(targetMs);
}
