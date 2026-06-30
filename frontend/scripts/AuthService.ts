export class AuthService {
    private static readonly KEY = 'auth';

    public static get data(): { passcode: string; expires_at: number } | null {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.passcode && parsed.expires_at) {
                if (Date.now() >= parsed.expires_at) {
                    this.clear();
                    return null;
                }
                return parsed;
            }
        } catch { }
        return null;
    }


    public static get passcode(): string | null {
        if (!this.data?.passcode) console.warn(`AuthService.passcode returned ${this.data}`);
        return this.data?.passcode || null;
    }

    public static save(passcode: string): void {
        const expires_at = Math.ceil(Date.now() / 86400000) * 86400000;
        localStorage.setItem(this.KEY, JSON.stringify({ passcode, expires_at }));
    }

    public static clear(): void {
        localStorage.removeItem(this.KEY);
    }
}