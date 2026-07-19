
const DOMAIN_KEY = 'blob-shuttle-v1-fixed-033f2cbacaf33df18c1224d463fbb4ce434faf6ce0065e999101b605b8fc541d';

export const encryptData = (plainText: string): string => Array.from(plainText).map((char, i) => {
    const code = char.charCodeAt(0) ^ DOMAIN_KEY.charCodeAt(i % DOMAIN_KEY.length);
    return code.toString(16).padStart(2, '0');
}).join('');

export const decryptData = (hexStr: string): string => {
    const matches = hexStr.match(/.{1,2}/g) || [];
    return matches.map((hex, i) => {
        const code = parseInt(hex, 16) ^ DOMAIN_KEY.charCodeAt(i % DOMAIN_KEY.length);
        return String.fromCharCode(code);
    }).join('');
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