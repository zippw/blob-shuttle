// Cookies and other custom headers are removed by Yandex Cloud Functions, so we store passcode in LocalStorage.
// There are 2 methods of authorization: passcode and invitation.

import { Authorization } from "../../src/shared/schema";

// LoginForm may be skipped and not rendered on server
class AuthService {
    public static _passcode: string | null = null; // cache pascode here in case localStorage is disabled
    private static readonly LS_KEY = 'auth';
    public static invitation_data: { vault_id: string, expires_at: number } = null;

    public static get auth(): Authorization {
        let invite;
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('invite')) invite = String(urlParams.get('invite'));

        const currentPasscode = this.passcode;

        const result = {
            ...(currentPasscode ? { passcode: currentPasscode } : {}),
            ...(invite ? { invite } : {})
        } as Authorization;

        console.debug('[AuthService] auth payload:', result);
        return result;
    }

    public static get data(): { passcode: string } | null {
        try {
            const raw = localStorage.getItem(this.LS_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.passcode) return parsed;
        } catch { }
        return null;
    }

    private static get passcode(): string | null {
        if (typeof this._passcode === 'string') return this._passcode;
        if (this.data === null) return null;
        if (!this.data?.passcode) console.warn(`[AuthService] invalid AuthService.passcode`, this.data);
        return this.data?.passcode || null;
    }

    public static save(passcode: string): void {
        localStorage.setItem(this.LS_KEY, JSON.stringify({ passcode }));
        this._passcode = passcode;
    }

    public static clear(): void {
        localStorage.removeItem(this.LS_KEY);
    }
}




export { AuthService }