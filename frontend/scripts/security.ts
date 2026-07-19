export async function encryptDataSymmetrically(cryptoKey: CryptoKey, plainText: string): Promise<string> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        new TextEncoder().encode(plainText)
    );

    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const dataHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');

    return `${ivHex}:${dataHex}`;
}

export async function decryptDataSymmetrically(cryptoKey: CryptoKey, encryptedStr: string): Promise<string> {
    const [ivHex, dataHex] = encryptedStr.split(':');
    if (!ivHex || !dataHex) throw new Error('Invalid format');

    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const data = new Uint8Array(dataHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
    );

    return new TextDecoder().decode(decrypted);
}

export async function generateDynamicHash(passcode: string): Promise<string> {
    const timestamp = Date.now();
    const encoder = new TextEncoder();

    const msgBuffer = encoder.encode(`${passcode}:${timestamp}`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);

    const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return `${hashHex}:${timestamp}`;
}

const DOMAIN_KEY = 'blob-shuttle-v1-fixed-033f2cbacaf33df18c1224d463fbb4ce434faf6ce0065e999101b605b8fc541d';
export async function getHardwareKey(): Promise<CryptoKey> {
    const parts = [
        navigator.language,
        navigator.hardwareConcurrency || 'unknown',
        screen.width + 'x' + screen.height,
        navigator.userAgent.slice(0, 50)
    ];
    
    let hash = 0;
    const str = parts.join('||');
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    const fingerprint = Math.abs(hash).toString(16).padStart(8, '0');
    const keyMaterial = (fingerprint + DOMAIN_KEY).padEnd(32, '0').slice(0, 32);
    
    const encoder = new TextEncoder();
    return await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(keyMaterial),
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}