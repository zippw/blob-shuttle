import {
    CreateVaultArgs, CreateInviteArgs, RevealVaultArgs, CheckAuthArgs,
    CreateVaultResult, CreateInviteResult, RevealVaultResult, CheckAuthResult,
    StructuredApiErr,
} from "@shared/schema";

import {
    assertCreateVaultArgs, assertCreateInviteArgs, assertRevealVaultArgs, assertCheckAuthArgs,
    assertCreateVaultResult, assertCreateInviteResult, assertRevealVaultResult, assertCheckAuthResult,
} from "@shared/validators";

import { ApiError } from '@shared/ApiError';

export default class ClientApi {
    public static async revealVault(bodyRaw: RevealVaultArgs): Promise<RevealVaultResult> {
        const body = assertRevealVaultArgs(bodyRaw);
        const data = await this.sendJSONPostRequest('reveal-vault', body);
        return assertRevealVaultResult(data);;
    }

    public static async createVault(bodyRaw: CreateVaultArgs): Promise<CreateVaultResult> {
        const body = assertCreateVaultArgs(bodyRaw);
        const data = await this.sendJSONPostRequest('create-vault', body);
        return assertCreateVaultResult(data);;
    }

    public static async createInvite(bodyRaw: CreateInviteArgs): Promise<CreateInviteResult> {
        const body = assertCreateInviteArgs(bodyRaw);
        const data = await this.sendJSONPostRequest('create-invite', body);
        return assertCreateInviteResult(data);
    }

    public static async checkAuth(bodyRaw: CheckAuthArgs): Promise<CheckAuthResult> {
        const body = assertCheckAuthArgs(bodyRaw);
        const data = await this.sendJSONPostRequest('check-auth', body);
        return assertCheckAuthResult(data);;
    }

    private static async sendJSONPostRequest(path: string, body: unknown) {
        const url = `${window.locals.api_url}?path=${path}`;
        try {
            const r = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'application/json' }
            });

            const rawText = await r.text();

            if (!r.ok) {
                let parsed: any = null;
                let isJson = false;

                try {
                    parsed = JSON.parse(rawText);
                    isJson = true;
                } catch {
                    isJson = false;
                }

                if (isJson && parsed && typeof parsed === 'object' && 'error' in parsed) throw new ApiError({
                    error: parsed.error,
                    details: parsed.details || `HTTP Status ${r.status}`,
                    type: parsed.type
                });

                throw new ApiError({
                    error: 'Server returned an unexpected response',
                    details: `Status: ${r.status} ${r.statusText}. Payload: ${rawText.slice(0, 200)}`,
                    type: 'UNEXPECTED'
                });
            }

            return JSON.parse(rawText);
        } catch (err) {
            if (err instanceof ApiError) throw err;

            if (err instanceof Error && err.message.startsWith('Validation Error:')) throw new ApiError({
                error: 'Local Validation Failed',
                details: err.message.replace('Validation Error:', '').trim(),
                type: 'VALIDATION'
            });

            throw new ApiError({
                error: 'Network connection lost',
                details: err instanceof Error ? err.message : String(err),
                type: 'NETWORK'
            });
        }
    }
}