import { Handler } from '@yandex-cloud/function-types';
import { renderFileRuntime } from './renderer';
import { decodeInviteHash, extractInviteToken } from './invite';
import { parseJSONBody } from './utils';
import { createInvite, createVault, revealVault, checkAuth } from './routes';
import * as consts from './shared/constants';
import { verifySessionAuthority } from './auth';
import { StructuredApiErr } from './shared/schema';
import { SessionContext, sessionStorage } from './session';


export const handler: Handler.Http = async (event, context) => {
    try {
        const method = event.httpMethod;
        const query = event.queryStringParameters || {};
        const bodyJSON = parseJSONBody(event); // yandex cloud specific parsing method

        const inviteHash = extractInviteToken(query, bodyJSON);
        const decodedInvite = inviteHash ? decodeInviteHash(inviteHash) : { is_valid: false as const };

        const { authorized, verifiedPasscode, isManual, cache_allowed } = verifySessionAuthority(bodyJSON, decodedInvite);
        const sessionContext: SessionContext = {
            session: {
                authorized, cache_allowed: authorized ? cache_allowed : false,
                passcode: isManual ? verifiedPasscode : undefined,
            },
            invite: decodedInvite.is_valid ? {
                is_valid: true,
                vault_id: decodedInvite.vault_id,
                expires_at: decodedInvite.expires_at,
                expires_in_sec: decodedInvite.expires_in_sec
            } : {
                is_valid: false
            }
        };

        return sessionStorage.run(sessionContext, async () => {
            try {


                console.log(`${method} ?path=${query.path || ''}. Auth=${authorized}`, sessionContext.invite);

                if (method === 'GET') return {
                    statusCode: 200, body: await renderFileRuntime('./views/authorized.js', { authorized, consts, sessionContext }),
                    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
                }

                if (!authorized) {
                    const err: StructuredApiErr = { error: 'Authentication failed.', details: 'Missing token or invalid credentials.', type: 'UNAUTHORIZED' }
                    return { statusCode: 401, body: JSON.stringify(err) };
                }

                // authorized endpoints
                if (method === 'POST' && query.path === 'check-auth') return await checkAuth(event, context);
                if (method === 'POST' && query.path === 'create-vault') return await createVault(event, context);
                if (method === 'POST' && query.path === 'reveal-vault') return await revealVault(event, context);
                if (method === 'POST' && query.path === 'create-invite') return await createInvite(event, context);

                const notFoundErr: StructuredApiErr = { error: 'Not Found.', details: `Endpoint doesn't exist`, type: 'NOTFOUND' }
                return { statusCode: 404, body: JSON.stringify(notFoundErr) };

            } catch (innerErr) {
                return formatServerErrorResponse(innerErr)
            }
        });

    } catch (err) {
        return formatServerErrorResponse(err)
    } finally { }
};








import { ApiError } from './shared/ApiError';
function formatServerErrorResponse(err: unknown) {
    if (err instanceof ApiError) {
        console.warn(`[Server ${err.type}]: ${err.error}`);

        const codes: Record<string, number> = {
            'VALIDATION': 400,
            'UNAUTHORIZED': 401,
            'NOTFOUND': 404
        }

        let statusCode: number = 500;
        if (codes[err.type]) statusCode = codes[err.type];

        console.error(err.type, err.details);

        return {
            statusCode,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: err.error, details: err.details, type: err.type })
        };
    }

    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error(`[Server CRITICAL CRASH]:`, err);

    return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            error: 'Internal Server Error',
            details: rawMessage,
            type: 'SERVER_CRASH'
        })
    };
}