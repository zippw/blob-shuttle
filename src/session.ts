import { InviteData } from './invite';
import { AsyncLocalStorage } from 'async_hooks';

export interface SessionContext {
    session: {
        authorized: boolean;
        passcode?: string;
        cache_allowed: boolean
    };
    invite: InviteData;
}

export const sessionStorage = new AsyncLocalStorage<SessionContext>();
export function getInviteData() {
    const store = sessionStorage.getStore();
    if (!store) return { is_valid: false as const };
    return store.invite;
}