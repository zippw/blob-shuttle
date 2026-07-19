// Cookies and other custom headers are removed by Yandex Cloud Functions, so we store passcode in LocalStorage.
// There are 2 methods of authorization: passcode and invitation.

import { Authorization } from "../../src/shared/schema";
import { encryptDataSymmetrically, decryptDataSymmetrically, generateDynamicHash, getHardwareKey } from './security';

// LoginForm may be skipped and not rendered on server
class AuthService {
    static #hwkey: CryptoKey;
    static #passcode: string | null = null; // session passcode cache (page instance)
    private static readonly LS_KEY = 'auth';
    public static invitation_data: { vault_id: string, expires_at: number } = null;

    public static async getAuth(): Promise<Authorization> {
        let invite;
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('invite')) invite = String(urlParams.get('invite'));

        const currentPasscode = await this.getPasscode();

        const result = {
            ...(currentPasscode ? { passcode: currentPasscode } : {}),
            ...(invite ? { invite } : {})
        } as Authorization;

        return result;
    }

    public static async init(): Promise<void> {
        try {
            this.#hwkey = await getHardwareKey();
            const raw = localStorage.getItem(this.LS_KEY);
            if (!raw) {
                console.debug('[AuthService] init: no localStorage data')
                return
            };

            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.passcode) {
                const passcodeDecrypted = await decryptDataSymmetrically(this.#hwkey, parsed.passcode);
                this.#passcode = passcodeDecrypted;

                console.debug('[AuthService] init finished');
                return;
            }
        } catch (err) {
            console.error('[AuthService]', err);
            return;
        }
    }

    private static async getPasscode(): Promise<string | null> {
        if (!this.#passcode) return null;
        const passcode = await generateDynamicHash(this.#passcode);
        return passcode;
    }

    public static set passcode(passcode: string) {
        this.#passcode = passcode;
    }

    public static async save(): Promise<void> {
        if (!this.#passcode) {
            console.warn('[AuthService] Cannot save empty passcode to localStorage');
            return;
        }

        const passcodeEncrypted = await encryptDataSymmetrically(this.#hwkey, this.#passcode)
        localStorage.setItem(this.LS_KEY, JSON.stringify({ passcode: passcodeEncrypted }));
    }

    public static clear(): void {
        this.#passcode = null;
        localStorage.removeItem(this.LS_KEY);
    }
}




export { AuthService }